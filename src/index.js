import { getProjectBySlug } from "./config/projects.js";
import { getTechnicalBias } from "./adapters/bybit.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/report/")) {
      return handleHybridReportApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};

async function handleHybridReportApi(request, env, url) {
  const slug = url.pathname.replace("/api/report/", "").replace(/\/$/, "");
  const project = getProjectBySlug(slug);
  if (!slug) return json({ error: "Missing report slug" }, 400);
  if (!project) return json({ error: "Unknown project slug", slug }, 404);

  const staticJson = await loadStaticReportJson(request, env, slug);
  if (!staticJson.ok) return staticJson.response;
  const report = staticJson.data;

  try {
    const live = await fetchLiveMetrics(project);
    mergeLiveMetrics(report, live);

    const statuses = Object.values(live.debug || {});
    const hasFulfilled = statuses.includes("fulfilled");
    const hasRejected = statuses.includes("rejected");
    report.meta.updated_at = new Date().toISOString();
    report.meta.live_debug = live.debug || {};

    if (hasFulfilled && hasRejected) report.meta.data_status = "hybrid-partial-live";
    else if (hasFulfilled) report.meta.data_status = "hybrid-live";
    else report.meta.data_status = "hybrid-fallback";

    return json(report, 200);
  } catch (error) {
    report.meta.updated_at = new Date().toISOString();
    report.meta.data_status = "hybrid-fallback";
    report.meta.live_error = error instanceof Error ? error.message : String(error);
    return json(report, 200);
  }
}

async function loadStaticReportJson(request, env, slug) {
  const jsonUrl = new URL(`/data/reports/${slug}.json`, request.url);
  const assetRequest = new Request(jsonUrl.toString(), request);
  const response = await env.ASSETS.fetch(assetRequest);

  if (response.status === 404) {
    return { ok: false, response: json({ error: "Report JSON not found", slug }, 404) };
  }
  if (!response.ok) {
    return { ok: false, response: json({ error: "Failed to load report JSON", slug, status: response.status }, 500) };
  }
  return { ok: true, data: await response.json() };
}

async function fetchLiveMetrics(project) {
  const results = await Promise.allSettled([
    fetchCoinGeckoMarket(project.coingeckoId),
    fetchCoinGeckoChart(project.coingeckoId),
    project.defillamaChain ? fetchDefiLlamaChains() : Promise.resolve(null),
    project.stablecoinChain ? fetchStablecoinChains() : Promise.resolve(null),
    project.defillamaChain ? fetchFeesOverview(project.defillamaChain) : Promise.resolve(null),
    project.defillamaChain ? fetchDexOverview(project.defillamaChain) : Promise.resolve(null),
    project.defillamaChain ? fetchTVLHistory(project.defillamaChain) : Promise.resolve([]),
    project.stablecoinChain ? fetchStablecoinHistory(project.stablecoinChain) : Promise.resolve([]),
    project.defillamaChain ? fetchChainUsersMetrics(project.defillamaChain) : Promise.resolve(null),
    getTechnicalBias(project.bybitSymbol),
  ]);

  const [cgMarketRes,cgChartRes,chainsRes,stableChainsRes,feesOverviewRes,dexOverviewRes,tvlHistoryRes,stableHistoryRes,usersRes,technicalBiasRes] = results;
  const cgMarket = cgMarketRes.status === "fulfilled" ? cgMarketRes.value : null;
  const cgChart = cgChartRes.status === "fulfilled" ? cgChartRes.value : null;
  const chains = chainsRes.status === "fulfilled" ? chainsRes.value : null;
  const stableChains = stableChainsRes.status === "fulfilled" ? stableChainsRes.value : null;
  const feesOverview = feesOverviewRes.status === "fulfilled" ? feesOverviewRes.value : null;
  const dexOverview = dexOverviewRes.status === "fulfilled" ? dexOverviewRes.value : null;
  const tvlHistoryRaw = tvlHistoryRes.status === "fulfilled" ? tvlHistoryRes.value : [];
  const stableHistoryRaw = stableHistoryRes.status === "fulfilled" ? stableHistoryRes.value : [];
  const usersData = usersRes.status === "fulfilled" ? usersRes.value : null;
  const technicalBias = technicalBiasRes.status === "fulfilled" ? technicalBiasRes.value : null;

  const chainNow = findChainData(chains, project.defillamaChain);
  const stableNow = findStableChainData(stableChains, project.stablecoinChain);

  const price = toNumber(cgMarket?.current_price);
  const marketCap = toNumber(cgMarket?.market_cap);
  const fdv = toNumber(cgMarket?.fully_diluted_valuation);
  const volume24h = toNumber(cgMarket?.total_volume);
  const circulatingSupply = toNumber(cgMarket?.circulating_supply);
  const totalSupply = toNumber(cgMarket?.total_supply);
  const maxSupply = toNumber(cgMarket?.max_supply);

  const tvlHistory = normalizeTvlHistory(tvlHistoryRaw);
  const stableHistory = normalizeStableHistory(stableHistoryRaw);
  const tvl = toNumber(chainNow?.tvl ?? getLastTVL(tvlHistory));
  const stablecoins = toNumber(extractStablecoinsCurrent(chainNow, stableNow) ?? getLastStable(stableHistory));
  const feesHistory = normalizeOverviewHistory(feesOverview?.totalDataChart);
  const dexHistory = normalizeOverviewHistory(dexOverview?.totalDataChart);
  const chainFees24h = toNumber(feesOverview?.total24h);
  const dexVolume24h = toNumber(dexOverview?.total24h);

  return {
    market: { price, marketCap, fdv, volume24h, circulatingSupply, totalSupply, maxSupply },
    capital: { tvl, stablecoins },
    financials: { chainFees24h, dexVolume24h },
    users: {
      dailyActiveAddresses24h: toNumber(usersData?.dailyActiveAddresses24h),
      newAddresses24h: toNumber(usersData?.newAddresses24h),
      transactions24h: toNumber(usersData?.transactions24h),
    },
    valuation: {
      marketCapTVL: safeDivide(marketCap, tvl),
      volumeMarketCap: safePercent(volume24h, marketCap),
      stablecoinsTVL: safeDivide(stablecoins, tvl),
    },
    charts: {
      priceHistory: Array.isArray(cgChart?.prices) ? cgChart.prices : [],
      tvlHistory,
      stableHistory,
      feesHistory,
      dexHistory,
    },
    technicalBias,
    debug: {
      cgMarket: cgMarketRes.status,
      cgChart: cgChartRes.status,
      chains: chainsRes.status,
      stableChains: stableChainsRes.status,
      feesOverview: feesOverviewRes.status,
      dexOverview: dexOverviewRes.status,
      tvlHistory: tvlHistoryRes.status,
      stableHistory: stableHistoryRes.status,
      users: usersRes.status,
      technicalBias: technicalBiasRes.status,
    },
  };
}

function mergeLiveMetrics(report, live) {
  const sourceCG = "CoinGecko";
  const sourceDL = "DefiLlama";

  if (isValidNumber(live.market.price)) report.market.price = liveMetric(live.market.price, formatMoney(live.market.price), sourceCG);
  if (isValidNumber(live.market.marketCap)) {
    const metric = liveMetric(live.market.marketCap, formatMoney(live.market.marketCap), sourceCG);
    report.market.market_cap = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.market_cap = metric;
  }
  if (isValidNumber(live.market.fdv)) {
    const metric = liveMetric(live.market.fdv, formatMoney(live.market.fdv), sourceCG);
    report.market.fdv = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.fdv = metric;
  }
  if (isValidNumber(live.market.volume24h)) {
    const metric = liveMetric(live.market.volume24h, formatMoney(live.market.volume24h), sourceCG);
    report.market.volume_24h = metric;
    if (report.liquidity?.metrics) report.liquidity.metrics.spot_volume = metric;
  }
  if (isValidNumber(live.market.circulatingSupply)) {
    const metric = liveMetric(live.market.circulatingSupply, new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(live.market.circulatingSupply), sourceCG);
    report.market.circulating_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.circulating_supply = metric;
  }
  if (isValidNumber(live.market.totalSupply)) {
    const metric = liveMetric(live.market.totalSupply, new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(live.market.totalSupply), sourceCG);
    report.market.total_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.total_supply = metric;
  }
  if (isValidNumber(live.market.maxSupply)) {
    const metric = liveMetric(live.market.maxSupply, new Intl.NumberFormat("ru-RU",{maximumFractionDigits:0}).format(live.market.maxSupply), sourceCG);
    report.market.max_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.max_supply = metric;
  }
  if (isValidNumber(live.capital.tvl)) report.capital.metrics.tvl = liveMetric(live.capital.tvl, formatMoney(live.capital.tvl), sourceDL);
  if (isValidNumber(live.capital.stablecoins)) report.capital.metrics.stablecoins_mcap = liveMetric(live.capital.stablecoins, formatMoney(live.capital.stablecoins), sourceDL);
  if (isValidNumber(live.financials.chainFees24h)) report.financials.metrics.chain_fees_24h = liveMetric(live.financials.chainFees24h, formatMoney(live.financials.chainFees24h), sourceDL);
  if (isValidNumber(live.financials.dexVolume24h)) {
    const metric = liveMetric(live.financials.dexVolume24h, formatMoney(live.financials.dexVolume24h), sourceDL);
    report.financials.metrics.dex_volume_24h = metric;
    if (report.liquidity?.metrics) report.liquidity.metrics.dex_volume_24h = metric;
  }
  if (isValidNumber(live.valuation.marketCapTVL)) report.valuation.metrics.market_cap_tvl = calcMetric(live.valuation.marketCapTVL, `${live.valuation.marketCapTVL.toFixed(2)}x`);
  if (isValidNumber(live.valuation.volumeMarketCap)) {
    const metric = calcMetric(live.valuation.volumeMarketCap, `${live.valuation.volumeMarketCap.toFixed(2)}%`);
    report.valuation.metrics.volume_market_cap = metric;
    report.financials.metrics.volume_market_cap = metric;
  }
  if (isValidNumber(live.valuation.stablecoinsTVL)) report.valuation.metrics.stablecoins_tvl = calcMetric(live.valuation.stablecoinsTVL, `${live.valuation.stablecoinsTVL.toFixed(2)}x`);
  if (live.charts.priceHistory?.length) report.charts.price_history = live.charts.priceHistory;
  if (live.charts.tvlHistory?.length) report.charts.tvl_history = live.charts.tvlHistory;
  if (live.charts.stableHistory?.length) report.charts.stablecoins_history = live.charts.stableHistory;
  if (live.charts.feesHistory?.length) report.charts.fees_history = live.charts.feesHistory;
  if (live.charts.dexHistory?.length) report.charts.dex_history = live.charts.dexHistory;
  mergeUsersMetrics(report, live.users);
  if (live.technicalBias) report.technical_bias = live.technicalBias;
  sanitizeUsersBlock(report);
}

function toNumber(value){
  if (value===null || value===undefined || value==="") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const compact = parseHumanNumber(value);
    if (Number.isFinite(compact)) return compact;
    const normalized = value.replace(/,/g, "").replace(/\s+/g, "");
    const num = Number(normalized);
    return Number.isFinite(num) ? num : null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}
function isValidNumber(value){ return typeof value === "number" && Number.isFinite(value); }
function liveMetric(value, formatted, source){ return { value, formatted, status:"live", source }; }
function calcMetric(value, formatted){ return { value, formatted, status:"calculated", source:"calc" }; }
function safeDivide(a,b){ if (!isValidNumber(a) || !isValidNumber(b) || b===0) return null; return a/b; }
function safePercent(a,b){ if (!isValidNumber(a) || !isValidNumber(b) || b===0) return null; return (a/b)*100; }
function formatMoney(value){ const num = toNumber(value); if (!isValidNumber(num)) return "—"; const abs = Math.abs(num); if (abs>=1e12) return `$${(num/1e12).toFixed(2)}T`; if (abs>=1e9) return `$${(num/1e9).toFixed(2)}B`; if (abs>=1e6) return `$${(num/1e6).toFixed(2)}M`; if (abs>=1e3) return `$${(num/1e3).toFixed(2)}K`; return `$${num.toFixed(2)}`; }

async function fetchCoinGeckoMarket(id){ const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&price_change_percentage=7d`,{headers:{accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"}}); if(!res.ok) throw new Error(`CoinGecko market error: ${res.status}`); const data = await res.json(); return data?.[0] || null; }
async function fetchCoinGeckoChart(id,days=365){ const res = await fetch(`https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,{headers:{accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"}}); if(!res.ok) throw new Error(`CoinGecko chart error: ${res.status}`); return res.json(); }
async function fetchDefiLlamaChains(){ const res = await fetch("https://api.llama.fi/v2/chains"); if(!res.ok) throw new Error(`DefiLlama chains error: ${res.status}`); return res.json(); }
async function fetchStablecoinChains(){ const res = await fetch("https://stablecoins.llama.fi/stablecoinchains"); if(!res.ok) throw new Error(`DefiLlama stable chains error: ${res.status}`); return res.json(); }
async function fetchFeesOverview(chain){ const res = await fetch(`https://api.llama.fi/overview/fees/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees`); if(!res.ok) throw new Error(`DefiLlama fees error: ${res.status}`); return res.json(); }
async function fetchDexOverview(chain){ const res = await fetch(`https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`); if(!res.ok) throw new Error(`DefiLlama dex error: ${res.status}`); return res.json(); }
async function fetchTVLHistory(chain){
  const chainSlug = String(chain || "").toLowerCase();
  const primary = await fetch(`https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chainSlug)}`);
  if (primary.ok) return primary.json();
  const fallback = await fetch(`https://api.llama.fi/charts/${encodeURIComponent(chain)}`);
  if (!fallback.ok) throw new Error(`DefiLlama TVL history error: ${primary.status}/${fallback.status}`);
  return fallback.json();
}
async function fetchStablecoinHistory(chain){ const res = await fetch(`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chain)}`); if(!res.ok) throw new Error(`DefiLlama stable history error: ${res.status}`); return res.json(); }
async function fetchChainUsersMetrics(chain){
  const chainSlug = String(chain || "").toLowerCase();
  const urls = [
    `https://defillama.com/chain/${encodeURIComponent(chainSlug)}?addresses=`,
    `https://defillama.com/chains/${encodeURIComponent(chain)}?addresses=`,
  ];

  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers:{
          accept:"text/html,application/xhtml+xml,application/json",
          "user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0",
        }
      });
      if (!res.ok) throw new Error(`DefiLlama users page error: ${res.status}`);
      const html = await res.text();
      const fromStructured = extractUsersFromNextData(html);
      const fromFallback = extractUsersFromHtmlText(html);
      const merged = {
        dailyActiveAddresses24h: toNumber(fromStructured?.dailyActiveAddresses24h ?? fromFallback?.dailyActiveAddresses24h),
        newAddresses24h: toNumber(fromStructured?.newAddresses24h ?? fromFallback?.newAddresses24h),
        transactions24h: toNumber(fromStructured?.transactions24h ?? fromFallback?.transactions24h),
      };
      if (isValidNumber(merged.dailyActiveAddresses24h) || isValidNumber(merged.newAddresses24h) || isValidNumber(merged.transactions24h)) {
        return merged;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return null;
}
function findChainData(chains, chainName){ return Array.isArray(chains) ? chains.find((item) => String(item.name).toLowerCase() === String(chainName).toLowerCase()) : null; }
function findStableChainData(chains, chainKey){ const target = String(chainKey || "").toLowerCase(); return Array.isArray(chains) ? chains.find((item) => [item?.gecko_id,item?.name,item?.chain,item?.tokenSymbol].filter(Boolean).map((v)=>String(v).toLowerCase()).includes(target)) : null; }
function extractStablecoinsCurrent(chainNow, stableNow){
  const fromChain = toNumber(chainNow?.stablecoins ?? chainNow?.stablecoinMcap ?? chainNow?.stablecoinsMcap ?? chainNow?.stables);
  if (isValidNumber(fromChain)) return fromChain;
  const rawStable = stableNow?.totalCirculatingUSD ?? stableNow?.totalCirculating ?? stableNow?.totalLiquidityUSD ?? stableNow?.mcap ?? null;
  if (isValidNumber(toNumber(rawStable))) return toNumber(rawStable);
  if (rawStable && typeof rawStable === "object") {
    return toNumber(
      rawStable.peggedUSD
      ?? rawStable.usd
      ?? rawStable.total
      ?? rawStable.current
      ?? null
    );
  }
  return null;
}
function getLastTVL(rows){ if(!Array.isArray(rows) || !rows.length) return null; return toNumber(rows[rows.length-1]?.totalLiquidityUSD); }
function getLastStable(rows){ if(!Array.isArray(rows) || !rows.length) return null; const last = rows[rows.length-1]; return toNumber(last?.totalCirculatingUSD ?? last?.totalCirculating?.peggedUSD ?? last?.totalCirculating?.usd ?? null); }
function toMillis(ts){ const num = Number(ts); if (!Number.isFinite(num)) return null; return num < 1e12 ? Math.trunc(num * 1000) : Math.trunc(num); }
function normalizeTvlHistory(rows){
  if (!Array.isArray(rows)) return [];
  const map = new Map();
  rows.forEach((row) => {
    const date = toMillis(row?.date);
    const value = toNumber(row?.totalLiquidityUSD ?? row?.tvl);
    if (!Number.isFinite(date) || !isValidNumber(value) || value <= 0) return;
    map.set(date, { ...row, date: Math.floor(date / 1000), totalLiquidityUSD: value });
  });
  return Array.from(map.values()).sort((a, b) => a.date - b.date);
}
function normalizeStableHistory(rows){
  if (!Array.isArray(rows)) return [];
  const map = new Map();
  rows.forEach((row) => {
    const date = toMillis(row?.date);
    const rawValue = row?.totalCirculatingUSD ?? row?.totalCirculating?.peggedUSD ?? row?.totalCirculating?.usd ?? row?.totalLiquidityUSD;
    const value = toNumber(rawValue);
    if (!Number.isFinite(date) || !isValidNumber(value) || value <= 0) return;
    map.set(date, { ...row, date: Math.floor(date / 1000), totalCirculatingUSD: value });
  });
  return Array.from(map.values()).sort((a, b) => a.date - b.date);
}
function normalizeOverviewHistory(rows){
  if (!Array.isArray(rows)) return [];
  const map = new Map();
  rows.forEach((row) => {
    const ts = Array.isArray(row) ? toMillis(row[0]) : toMillis(row?.date);
    const value = Array.isArray(row) ? toNumber(row[1]) : toNumber(row?.value ?? row?.total);
    if (!Number.isFinite(ts) || !isValidNumber(value) || value <= 0) return;
    map.set(ts, [Math.floor(ts / 1000), value]);
  });
  const sorted = Array.from(map.values()).sort((a, b) => a[0] - b[0]);
  const firstValidIndex = sorted.findIndex(([, value]) => value > 0);
  if (firstValidIndex < 0) return [];
  return sorted.slice(firstValidIndex);
}
function extractUsersFromNextData(html){
  if (!html) return null;
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match?.[1]) return null;
  try {
    const payload = JSON.parse(match[1]);
    const found = {
      dailyActiveAddresses24h: findNumberByKeys(payload, ["activeaddresses24h", "dailyactiveaddresses24h"]),
      newAddresses24h: findNumberByKeys(payload, ["newaddresses24h"]),
      transactions24h: findNumberByKeys(payload, ["transactions24h"]),
    };
    if (!isValidNumber(found.dailyActiveAddresses24h)) found.dailyActiveAddresses24h = findNumberByLabel(payload, "active addresses (24h)");
    if (!isValidNumber(found.newAddresses24h)) found.newAddresses24h = findNumberByLabel(payload, "new addresses (24h)");
    if (!isValidNumber(found.transactions24h)) found.transactions24h = findNumberByLabel(payload, "transactions (24h)");
    if (isValidNumber(found.dailyActiveAddresses24h) || isValidNumber(found.newAddresses24h) || isValidNumber(found.transactions24h)) {
      return found;
    }
  } catch {}
  return null;
}
function findNumberByKeys(node, expectedKeys){
  if (!node) return null;
  const queue = [node];
  const target = new Set((expectedKeys || []).map((x) => String(x).toLowerCase()));
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    for (const [key, value] of Object.entries(item)) {
      if (target.has(String(key).toLowerCase())) {
        const num = toNumber(typeof value === "object" ? value?.value ?? value?.current ?? value?.amount : value);
        if (isValidNumber(num)) return num;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function findNumberByLabel(node, label){
  if (!node || !label) return null;
  const target = String(label).toLowerCase();
  const queue = [node];
  while (queue.length) {
    const item = queue.shift();
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item)) {
      queue.push(...item);
      continue;
    }
    const title = String(item?.name ?? item?.title ?? item?.label ?? "").toLowerCase();
    if (title === target || title.includes(target)) {
      const num = toNumber(item?.value ?? item?.amount ?? item?.current ?? item?.displayValue);
      if (isValidNumber(num)) return num;
    }
    for (const value of Object.values(item)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function mergeUsersMetrics(report, users){
  if (!report?.users?.metrics || !users) return;
  const source = "DefiLlama";
  const active = toNumber(users.dailyActiveAddresses24h);
  const fresh = toNumber(users.newAddresses24h);
  const tx = toNumber(users.transactions24h);
  if (isValidNumber(active)) report.users.metrics.daily_active_addresses = liveMetric(active, formatCompactCount(active), source);
  if (isValidNumber(fresh)) report.users.metrics.new_addresses = liveMetric(fresh, formatCompactCount(fresh), source);
  if (isValidNumber(tx)) report.users.metrics.transactions = liveMetric(tx, formatCompactCount(tx), source);
}

function formatCompactCount(value){
  const num = toNumber(value);
  if (!isValidNumber(num)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits:0 }).format(num);
}

function extractMetricFromHtml(html, label){
  if (!html || !label) return null;
  const escaped = escapeRegExp(label);
  const pattern = new RegExp(`${escaped}\\s*([0-9][0-9.,\\s]*[kKmMbB]?)`, "i");
  const match = html.match(pattern);
  if (!match?.[1]) return null;
  return parseHumanNumber(match[1]);
}

function extractUsersFromHtmlText(html){
  if (!html) return null;
  return {
    dailyActiveAddresses24h: toNumber(extractMetricFromHtml(html, "Active Addresses (24h)")),
    newAddresses24h: toNumber(extractMetricFromHtml(html, "New Addresses (24h)")),
    transactions24h: toNumber(extractMetricFromHtml(html, "Transactions (24h)")),
  };
}

function parseHumanNumber(raw){
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().replace(/\s+/g, "");
  if (!value) return null;
  const suffix = value.slice(-1).toLowerCase();
  let multiplier = 1;
  let core = value;
  if (suffix === "k" || suffix === "m" || suffix === "b") {
    core = value.slice(0, -1);
    if (suffix === "k") multiplier = 1e3;
    if (suffix === "m") multiplier = 1e6;
    if (suffix === "b") multiplier = 1e9;
  }
  const normalized = core.replace(/,/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed * multiplier;
}

function escapeRegExp(value){
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function sanitizeUsersBlock(report){
  if (!report?.users?.metrics) return;
  const cleanFormatted = "данные временно недоступны";
  Object.values(report.users.metrics).forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (String(item.formatted || "").toLowerCase().includes("источник подключается")) item.formatted = cleanFormatted;
    if (!item.status || item.status === "unavailable") item.status = "partial";
    if (!item.source) item.source = "source pending";
  });
  if (Array.isArray(report.users.text) && report.users.text.length) {
    report.users.text = report.users.text.map((line) => String(line).replaceAll("источник подключается", cleanFormatted));
  }
}
function json(data,status=200){ return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=300"}}); }
