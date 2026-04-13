import { getProjectBySlug } from "./config/projects.js";
import { getTechnicalBias } from "./adapters/bybit.js";
import { fetchUsersMetrics } from "./lib/users-source.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/report/")) {
      return handleHybridReportApi(request, env, url);
    }
    return env.ASSETS.fetch(request);
  },
};

const COINGECKO_MARKET_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const coinGeckoMarketSnapshots = new Map();

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
    applyBlockRenderingRules(report, project, live);

    const statuses = Object.values(live.debug || {});
    const hasFulfilled = statuses.includes("fulfilled");
    const hasRejected = statuses.includes("rejected");
    report.meta = report.meta || {};
    report.meta.updated_at = new Date().toISOString();
    report.meta.live_debug = live.debug || {};
    report.meta.live_debug_reasons = live.debugReasons || {};

    if (hasFulfilled && hasRejected) report.meta.data_status = "hybrid-partial-live";
    else if (hasFulfilled) report.meta.data_status = "hybrid-live";
    else report.meta.data_status = "hybrid-fallback";

    report.meta.generated_at = new Date().toISOString();
    return json(report, 200, { cacheControl: resolveReportCacheControl(report.meta.data_status) });
  } catch (error) {
    report.meta = report.meta || {};
    report.meta.updated_at = new Date().toISOString();
    report.meta.data_status = "hybrid-fallback";
    report.meta.live_error = error instanceof Error ? error.message : String(error);
    report.meta.generated_at = new Date().toISOString();
    applyBlockRenderingRules(report, project, null);
    return json(report, 200, { cacheControl: resolveReportCacheControl(report.meta.data_status) });
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
    fetchUsersMetrics(project, { toNumber }),
    getTechnicalBias(project.bybitSymbol),
  ]);

  const [cgMarketRes,cgChartRes,chainsRes,stableChainsRes,feesOverviewRes,dexOverviewRes,tvlHistoryRes,stableHistoryRes,usersRes,technicalBiasRes] = results;
  const cgMarket = cgMarketRes.status === "fulfilled" ? cgMarketRes.value : null;
  const cachedCoinGeckoMarket = getCoinGeckoMarketSnapshot(project.coingeckoId);
  const hasFreshCoinGeckoMarket = hasAnyCoinGeckoMarketValue(cgMarket);
  const hasCachedCoinGeckoMarket = hasAnyCoinGeckoMarketValue(cachedCoinGeckoMarket);
  const effectiveCoinGeckoMarket = hasFreshCoinGeckoMarket
    ? cgMarket
    : (hasCachedCoinGeckoMarket ? cachedCoinGeckoMarket : null);
  const marketMetricsMode = hasFreshCoinGeckoMarket
    ? "live_fresh"
    : (hasCachedCoinGeckoMarket ? "live_cached_fallback" : "manual_static_fallback");
  if (hasFreshCoinGeckoMarket) setCoinGeckoMarketSnapshot(project.coingeckoId, cgMarket);
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

  const price = toNumber(effectiveCoinGeckoMarket?.current_price);
  const marketCap = toNumber(effectiveCoinGeckoMarket?.market_cap);
  const fdv = toNumber(effectiveCoinGeckoMarket?.fully_diluted_valuation);
  const volume24h = toNumber(effectiveCoinGeckoMarket?.total_volume);
  const circulatingSupply = toNumber(effectiveCoinGeckoMarket?.circulating_supply);
  const totalSupply = toNumber(effectiveCoinGeckoMarket?.total_supply);
  const maxSupply = toNumber(effectiveCoinGeckoMarket?.max_supply);
  const cgMarketError = parsePromiseRejection(cgMarketRes.reason);

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
      source: usersData?.source || null,
      provider: usersData?.provider || null,
      status: usersData?.status || "partial",
      reason: usersData?.reason || null,
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
      marketMetricsMode,
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
    debugReasons: {
      cgMarket: cgMarketError,
      cgMarketFallback: {
        usedCachedSnapshot: marketMetricsMode === "live_cached_fallback",
        snapshotTtlMs: COINGECKO_MARKET_SNAPSHOT_TTL_MS,
      },
    },
  };
}

function setCoinGeckoMarketSnapshot(id, marketData) {
  if (!id || !hasAnyCoinGeckoMarketValue(marketData)) return;
  coinGeckoMarketSnapshots.set(String(id), {
    marketData,
    updatedAt: Date.now(),
  });
}

function getCoinGeckoMarketSnapshot(id) {
  if (!id) return null;
  const key = String(id);
  const snapshot = coinGeckoMarketSnapshots.get(key);
  if (!snapshot) return null;
  if ((Date.now() - snapshot.updatedAt) > COINGECKO_MARKET_SNAPSHOT_TTL_MS) {
    coinGeckoMarketSnapshots.delete(key);
    return null;
  }
  return snapshot.marketData;
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
  sanitizeUsersBlock(report, live.users);
}

function applyBlockRenderingRules(report, project, live){
  if (!report?.meta) return;
  const usersState = live?.users || null;
  report.meta.features = {
    ...(report.meta.features || {}),
    usersBlock: shouldRenderUsersBlock(report, project, usersState),
  };
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

class CoinGeckoMarketError extends Error {
  constructor(type, details = {}) {
    super(`CoinGecko market error: ${type}`);
    this.name = "CoinGeckoMarketError";
    this.type = type;
    this.details = details;
  }
}
async function fetchCoinGeckoMarket(id){
  const primaryUrl = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}&price_change_percentage=7d`;
  let primary;
  try {
    primary = await fetchJsonWithTimeout(primaryUrl, 9000);
  } catch (error) {
    if (error instanceof CoinGeckoMarketError && error.type === "timeout") {
      const fallback = await fetchCoinGeckoMarketFallback(id);
      if (fallback) return fallback;
    }
    throw error;
  }
  if (!primary.ok) {
    const fallback = await fetchCoinGeckoMarketFallback(id);
    if (fallback) return fallback;
    throw new CoinGeckoMarketError("status_code", { endpoint: "coins/markets", status: primary.status, fallback: "coins/{id}" });
  }
  if (!Array.isArray(primary.data)) {
    const fallback = await fetchCoinGeckoMarketFallback(id);
    if (fallback) return fallback;
    throw new CoinGeckoMarketError("bad_payload", { endpoint: "coins/markets", payloadType: typeof primary.data, fallback: "coins/{id}" });
  }

  const marketRow = primary.data[0];
  if (marketRow && hasAnyCoinGeckoMarketValue(marketRow)) return marketRow;
  if (!marketRow) {
    const fallback = await fetchCoinGeckoMarketFallback(id);
    if (fallback) return fallback;
    throw new CoinGeckoMarketError("empty_array", { endpoint: "coins/markets", fallback: "coins/{id}" });
  }

  const fallback = await fetchCoinGeckoMarketFallback(id);
  if (fallback) return fallback;
  throw new CoinGeckoMarketError("bad_payload", { endpoint: "coins/markets", reason: "missing_market_fields", fallback: "coins/{id}" });
}
async function fetchCoinGeckoMarketFallback(id) {
  const fallbackUrl = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`;
  const fallback = await fetchJsonWithTimeout(fallbackUrl, 9000);
  if (!fallback.ok) throw new CoinGeckoMarketError("status_code", { endpoint: "coins/{id}", status: fallback.status });
  const marketData = fallback.data?.market_data;
  if (!marketData || typeof marketData !== "object") throw new CoinGeckoMarketError("bad_payload", { endpoint: "coins/{id}", reason: "missing_market_data" });

  const normalized = {
    current_price: marketData.current_price?.usd,
    market_cap: marketData.market_cap?.usd,
    fully_diluted_valuation: marketData.fully_diluted_valuation?.usd,
    total_volume: marketData.total_volume?.usd,
    circulating_supply: marketData.circulating_supply,
    total_supply: marketData.total_supply,
    max_supply: marketData.max_supply,
  };
  if (!hasAnyCoinGeckoMarketValue(normalized)) return null;
  return normalized;
}
function hasAnyCoinGeckoMarketValue(row) {
  return ["current_price","market_cap","fully_diluted_valuation","total_volume","circulating_supply","total_supply","max_supply"]
    .some((key) => isValidNumber(toNumber(row?.[key])));
}
async function fetchJsonWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers:{accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"},
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error?.name === "AbortError") throw new CoinGeckoMarketError("timeout", { timeoutMs, url });
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
function parsePromiseRejection(reason) {
  if (!reason) return null;
  if (reason instanceof CoinGeckoMarketError) {
    return {
      type: reason.type,
      ...reason.details,
    };
  }
  return {
    type: "unknown_error",
    message: reason instanceof Error ? reason.message : String(reason),
  };
}
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
function mergeUsersMetrics(report, users){
  if (!report?.users?.metrics || !users) return;
  const source = users.source || users.provider || "Users provider";
  const active = toNumber(users.dailyActiveAddresses24h);
  const fresh = toNumber(users.newAddresses24h);
  const tx = toNumber(users.transactions24h);

  if (users.status !== "live") {
    report.users.metrics.daily_active_addresses = partialMetric(source);
    report.users.metrics.new_addresses = partialMetric(source);
    report.users.metrics.transactions = partialMetric(source);
    return;
  }

  if (isValidNumber(active)) report.users.metrics.daily_active_addresses = liveMetric(active, formatCompactCount(active), source);
  if (isValidNumber(fresh)) report.users.metrics.new_addresses = liveMetric(fresh, formatCompactCount(fresh), source);
  if (isValidNumber(tx)) report.users.metrics.transactions = liveMetric(tx, formatCompactCount(tx), source);
}

function partialMetric(source){ return { value:null, formatted:"данные временно недоступны", status:"partial", source }; }
function formatCompactCount(value){
  const num = toNumber(value);
  if (!isValidNumber(num)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits:0 }).format(num);
}

function sanitizeUsersBlock(report, usersState){
  if (!report?.users?.metrics) return;
  const cleanFormatted = "данные временно недоступны";
  const fallbackSource = usersState?.source || usersState?.provider || usersState?.reason || "users provider not configured";
  Object.values(report.users.metrics).forEach((item) => {
    if (!item || typeof item !== "object") return;
    if (String(item.formatted || "").toLowerCase().includes("источник подключается")) item.formatted = cleanFormatted;
    if (!item.status || item.status === "unavailable") item.status = "partial";
    if (!item.source) item.source = fallbackSource;
  });
  if (Array.isArray(report.users.text) && report.users.text.length) {
    report.users.text = report.users.text.map((line) => String(line).replaceAll("источник подключается", cleanFormatted));
  }
}
function shouldRenderUsersBlock(report, project, usersState){
  if (!report?.users) return false;
  const providerType = String(project?.usersSource?.type || "none").toLowerCase();
  if (!providerType || providerType === "none") return false;
  return true;
}
function resolveReportCacheControl(dataStatus){
  if (dataStatus === "hybrid-live") return "public, max-age=60";
  if (dataStatus === "hybrid-partial-live") return "public, max-age=15";
  return "no-cache, must-revalidate";
}
function json(data,status=200,{ cacheControl = "public, max-age=300" } = {}){ return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":cacheControl}}); }
