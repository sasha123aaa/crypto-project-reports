import { getSectionSelection } from "./config/projects.js";
import { resolveProject } from "./lib/project-resolution.js";
import { buildReport } from "./lib/build-report.js";
import { applySectionSelection, isSectionSelected } from "./lib/section-selection.js";
import { getTechnicalBias } from "./adapters/bybit.js";
import { marketTechnicalRoute } from "./lib/market-symbols.js";
import { fetchUsersMetrics } from "./lib/users-source.js";
import { fetchDefiLlamaRwaActiveMcap, fetchStablecoinChains, fetchStablecoinHistory, normalizeStablecoinHistory, stablecoinMcapUsd } from "./adapters/defillama.js";
import { fetchCoinGeckoGlobal, fetchProjectNews } from "./adapters/coingecko.js";
import { fetchBitcoinValuationHistory } from "./adapters/coinmetrics.js";
import { fetchBitcoinEtfFlows } from "./adapters/farside.js";
import { formatCompactNumber, formatMoney, formatPrice } from "./lib/formatters.js";
import { applyProfileAwareSemantics } from "./lib/profile-semantics.js";
import { orchestrateReportSources, publishReportReadiness } from "./lib/report-readiness.js";
import { getCachedReport, responseFromSnapshot, responseSnapshot, runSingleFlight, setCachedReport } from "./lib/report-cache.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/report/")) {
      return handleHybridReportApi(request, env, url, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};

const COINGECKO_MARKET_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const coinGeckoMarketSnapshots = new Map();

async function handleHybridReportApi(request, env, url, ctx) {
  const input = decodeURIComponent(url.pathname.replace("/api/report/", "").replace(/\/$/, "")).trim().toLowerCase();
  if (!input) return json({ error: "Missing report slug or ticker" }, 400);

  const cached = getCachedReport(input);
  if (cached?.cacheState === "fresh") return responseFromSnapshot(cached, "fresh");
  if (cached?.cacheState === "stale") {
    const refresh = runSingleFlight(input, () => buildAndCacheReport(request, env, url, input));
    if (ctx?.waitUntil) ctx.waitUntil(refresh);
    else refresh.catch(() => {});
    return responseFromSnapshot(cached, "stale");
  }

  const snapshot = await runSingleFlight(input, () => buildAndCacheReport(request, env, url, input));
  return responseFromSnapshot(snapshot, "miss");
}

async function buildAndCacheReport(request, env, url, input) {
  const response = await buildHybridReportResponse(request, env, url, input);
  const snapshot = await responseSnapshot(response);
  return setCachedReport(input, snapshot);
}

async function buildHybridReportResponse(request, env, url, input) {
  let project;
  try {
    project = await resolveProject(input);
  } catch (error) {
    return json({ error:"Project resolution failed", input, reason:error instanceof Error ? error.message : String(error) }, 502);
  }
  if (!project) return json({ error: "Unknown project slug or ticker", input }, 404);
  if (project.resolution?.mode === "runtime") return handleRuntimeReport(project);

  const slug = project.slug;
  const staticJson = await loadStaticReportJson(request, env, slug);
  if (!staticJson.ok) return staticJson.response;
  const report = staticJson.data;
  report.meta = report.meta || {};
  report.meta.project_resolution = project.resolution;
  report.meta.branding = project.branding || report.meta.branding || null;
  report.meta.market_symbols = project.marketSymbols || report.meta.market_symbols || null;
  applySectionSelection(report, project);

  try {
    const live = await fetchLiveMetrics(project);
    mergeLiveMetrics(report, live);
    applyProfileAwareSemantics(report, project, { preserveCurated:Boolean(project.reportOptions?.preserveCuratedSemantics) });
    applySectionSelection(report, project);
    applyBlockRenderingRules(report, project, live);
    const readiness = publishReportReadiness(report, project, live.readinessSummary);
    if (readiness.state !== "ready") return json({ error:"Critical report data unavailable", readiness }, 503, { cacheControl:"no-store" });

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
    applyProfileAwareSemantics(report, project, { preserveCurated:Boolean(project.reportOptions?.preserveCuratedSemantics) });
    applySectionSelection(report, project);
    applyBlockRenderingRules(report, project, null);
    const readiness = publishReportReadiness(report, project);
    if (readiness.state !== "ready") return json({ error:"Critical report data unavailable", readiness }, 503, { cacheControl:"no-store" });
    return json(report, 200, { cacheControl: resolveReportCacheControl(report.meta.data_status) });
  }
}


async function handleRuntimeReport(project) {
  try {
    const report = await buildReport(project);
    report.meta = report.meta || {};
    report.meta.project_resolution = project.resolution;
    report.meta.branding = project.branding || report.meta.branding || null;
    report.meta.market_symbols = project.marketSymbols || report.meta.market_symbols || null;
    report.meta.data_status = "runtime-partial";
    report.meta.generated_at = new Date().toISOString();
    const readiness = publishReportReadiness(report, project, report.meta.source_readiness);
    if (readiness.state !== "ready") return json({ error:"Critical runtime report data unavailable", readiness }, 503, { cacheControl:"no-store" });
    return json(report, 200, { cacheControl:resolveReportCacheControl(report.meta.data_status) });
  } catch (error) {
    return json({ error:"Runtime report build failed", ticker:project.ticker, reason:error instanceof Error ? error.message : String(error) }, 502);
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
  const initialSelection = getSectionSelection(project);
  const selected = (section) => isSectionSelected(initialSelection, section);
  const { results, summary:readinessSummary } = await orchestrateReportSources([
    { name:"cgMarket", critical:true, attempts:3, load:()=>fetchCoinGeckoMarket(project.coingeckoId), validate:hasCoreCoinGeckoMarketValue },
    { name:"cgChart", load:()=>fetchCoinGeckoChart(project.coingeckoId) },
    { name:"chains", load:()=>project.defillamaChain && selected("tvl_and_capital") ? fetchDefiLlamaChains() : null },
    { name:"stableChains", load:()=>project.stablecoinChain && selected("stablecoins") ? fetchStablecoinChains() : null },
    { name:"appFeesOverview", load:()=>project.defillamaChain && selected("financials") ? fetchAppFeesOverview(project.defillamaChain) : null },
    { name:"chainFeesOverview", load:()=>project.defillamaChain && selected("financials") ? fetchChainFeesOverview(project.defillamaChain) : null },
    { name:"dexOverview", load:()=>project.defillamaChain && (selected("financials") || selected("liquidity_and_trading")) ? fetchDexOverview(project.defillamaChain) : null },
    { name:"tvlHistory", load:()=>project.defillamaChain && selected("tvl_and_capital") ? fetchTVLHistory(project.defillamaChain) : [] },
    { name:"stableHistory", load:()=>project.stablecoinChain && selected("stablecoins") ? fetchStablecoinHistory(project.stablecoinChain) : [] },
    { name:"users", load:()=>selected("users_and_activity") ? fetchUsersMetrics(project, { toNumber }) : null },
    { name:"technicalBias", load:()=>getTechnicalBias(marketTechnicalRoute(project.marketSymbols)) },
    { name:"rwa", load:()=>project.rwaChain && selected("rwa") ? fetchDefiLlamaRwaActiveMcap(project.rwaChain) : null },
    { name:"news", load:()=>selected("narrative_and_news") ? fetchProjectNews(project) : null },
    { name:"btcValuation", load:()=>project.slug === "btc" ? fetchBitcoinValuationHistory() : null },
    { name:"btcDominance", load:()=>project.slug === "btc" ? fetchCoinGeckoGlobal() : null },
    { name:"btcEtfFlows", load:()=>project.slug === "btc" ? fetchBitcoinEtfFlows() : null },
  ]);

  const { cgMarket:cgMarketRes, cgChart:cgChartRes, chains:chainsRes, stableChains:stableChainsRes, appFeesOverview:appFeesOverviewRes, chainFeesOverview:chainFeesOverviewRes, dexOverview:dexOverviewRes, tvlHistory:tvlHistoryRes, stableHistory:stableHistoryRes, users:usersRes, technicalBias:technicalBiasRes, rwa:rwaRes, news:newsRes, btcValuation:btcValuationRes, btcDominance:cgGlobalRes, btcEtfFlows:btcEtfRes } = results;
  const cgMarket = cgMarketRes.status === "fulfilled" ? cgMarketRes.value : null;
  const cachedCoinGeckoMarket = getCoinGeckoMarketSnapshot(project.coingeckoId);
  const hasFreshCoinGeckoMarket = hasAnyCoinGeckoMarketValue(cgMarket);
  const hasCachedCoinGeckoMarket = hasAnyCoinGeckoMarketValue(cachedCoinGeckoMarket);
  const effectiveCoinGeckoMarket = mergeCoinGeckoMarketData(cgMarket, cachedCoinGeckoMarket);
  const usesCachedCoinGeckoFields = hasFreshCoinGeckoMarket && hasCachedCoinGeckoMarket
    && COINGECKO_MARKET_FIELDS.some((field) => !isValidNumber(toNumber(cgMarket?.[field])) && isValidNumber(toNumber(cachedCoinGeckoMarket?.[field])));
  const marketMetricsMode = hasFreshCoinGeckoMarket
    ? (usesCachedCoinGeckoFields ? "live_fresh_with_cached_fields" : "live_fresh")
    : (hasCachedCoinGeckoMarket ? "live_cached_fallback" : "manual_static_fallback");
  if (hasFreshCoinGeckoMarket) setCoinGeckoMarketSnapshot(project.coingeckoId, effectiveCoinGeckoMarket);
  const cgChart = cgChartRes.status === "fulfilled" ? cgChartRes.value : null;
  const chains = chainsRes.status === "fulfilled" ? chainsRes.value : null;
  const stableChains = stableChainsRes.status === "fulfilled" ? stableChainsRes.value : null;
  const appFeesOverview = appFeesOverviewRes.status === "fulfilled" ? appFeesOverviewRes.value : null;
  const chainFeesOverview = chainFeesOverviewRes.status === "fulfilled" ? chainFeesOverviewRes.value : null;
  const dexOverview = dexOverviewRes.status === "fulfilled" ? dexOverviewRes.value : null;
  const tvlHistoryRaw = tvlHistoryRes.status === "fulfilled" ? tvlHistoryRes.value : [];
  const stableHistoryRaw = stableHistoryRes.status === "fulfilled" ? stableHistoryRes.value : [];
  const usersData = usersRes.status === "fulfilled" ? usersRes.value : null;
  const technicalBias = technicalBiasRes.status === "fulfilled" ? technicalBiasRes.value : null;
  const rwa = rwaRes.status === "fulfilled" ? rwaRes.value : null;
  const news = newsRes.status === "fulfilled" ? newsRes.value : { status:"unavailable", items:[], source:"Configured news feeds", source_summary:"All configured news sources are temporarily unavailable", updated_at:new Date().toISOString(), debug:{ sources:[], error:parsePromiseRejection(newsRes.reason) } };
  const btcValuation = btcValuationRes.status === "fulfilled" ? btcValuationRes.value : null;
  const btcDominance = toNumber(cgGlobalRes.status === "fulfilled" ? cgGlobalRes.value?.data?.market_cap_percentage?.btc : null);
  const btcEtf = btcEtfRes.status === "fulfilled" ? btcEtfRes.value : null;

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
  const stableHistory = normalizeStablecoinHistory(stableHistoryRaw);
  const tvl = toNumber(chainNow?.tvl ?? getLastTVL(tvlHistory));
  const stablecoins = toNumber(extractStablecoinsCurrent(chainNow, stableNow) ?? getLastStable(stableHistory));
  const appFeesHistory = normalizeOverviewHistory(appFeesOverview?.totalDataChart);
  const chainFeesHistory = normalizeOverviewHistory(chainFeesOverview?.totalDataChart);
  const dexHistory = normalizeOverviewHistory(dexOverview?.totalDataChart);
  const appFees24h = toNumber(appFeesOverview?.total24h);
  const chainFees24h = toNumber(chainFeesOverview?.total24h);
  const dexVolume24h = toNumber(dexOverview?.total24h);

  return {
    market: {
      price, marketCap, fdv, volume24h, circulatingSupply, totalSupply, maxSupply,
      source: marketMetricsMode === "live_cached_fallback" ? "CoinGecko cached snapshot" : (marketMetricsMode === "live_fresh_with_cached_fields" ? "CoinGecko + cached snapshot" : "CoinGecko"),
    },
    capital: { tvl, stablecoins, rwaActiveMcap: toNumber(rwa?.value), rwaSource: rwa?.source || "DefiLlama RWA", rwaUpdatedAt: rwa?.updated_at || null },
    financials: { appFees24h, chainFees24h, dexVolume24h },
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
      annualizedChainFeesMarketCap: safePercent(chainFees24h == null ? null : chainFees24h * 365, marketCap),
      annualizedAppFeesMarketCap: safePercent(appFees24h == null ? null : appFees24h * 365, marketCap),
      dexVolumeMarketCap: safePercent(dexVolume24h, marketCap),
    },
    btc: project.slug === "btc" ? {
      ...btcValuation?.current,
      dominance:btcDominance,
      etf:btcEtf?.current || null,
      valuationSource:btcValuation?.source || "Coin Metrics Community API",
      etfSource:btcEtf?.source || "Farside Investors",
    } : null,
    charts: {
      priceHistory: Array.isArray(cgChart?.prices) ? cgChart.prices : [],
      volumeHistory: Array.isArray(cgChart?.total_volumes) ? cgChart.total_volumes : [],
      marketCapHistory: Array.isArray(cgChart?.market_caps) ? cgChart.market_caps : [],
      tvlHistory,
      stableHistory,
      appFeesHistory,
      chainFeesHistory,
      dexHistory,
      mvrvHistory: btcValuation?.charts?.mvrv || [],
      realizedPriceHistory: btcValuation?.charts?.realizedPrice || [],
      btcMarketPriceHistory: btcValuation?.charts?.marketPrice || [],
      issuanceHistory: btcValuation?.charts?.issuance || [],
      btcEtfFlowHistory: btcEtf?.charts?.daily || [],
      btcEtfCumulativeHistory: btcEtf?.charts?.cumulative || [],
    },
    technicalBias,
    news,
    debug: {
      cgMarket: cgMarketRes.status,
      marketMetricsMode,
      cgChart: cgChartRes.status,
      chains: chainsRes.status,
      stableChains: stableChainsRes.status,
      appFeesOverview: appFeesOverviewRes.status,
      chainFeesOverview: chainFeesOverviewRes.status,
      dexOverview: dexOverviewRes.status,
      tvlHistory: tvlHistoryRes.status,
      stableHistory: stableHistoryRes.status,
      users: usersRes.status,
      technicalBias: technicalBiasRes.status,
      rwa: rwaRes.status,
      news: news?.debug || { status: newsRes.status },
      btcValuation: btcValuationRes.status,
      btcDominance: cgGlobalRes.status,
      btcEtfFlows: btcEtfRes.status,
    },
    readinessSummary,
    debugReasons: {
      cgMarket: cgMarketError,
      cgMarketFallback: {
        usedCachedSnapshot: marketMetricsMode === "live_cached_fallback" || marketMetricsMode === "live_fresh_with_cached_fields",
        snapshotTtlMs: COINGECKO_MARKET_SNAPSHOT_TTL_MS,
      },
      rwa: rwaRes.status === "fulfilled" ? rwa?.debug || null : rwaRes.reason?.debug || parsePromiseRejection(rwaRes.reason),
      btcEtfFlows: btcEtfRes.status === "rejected" ? parsePromiseRejection(btcEtfRes.reason) : null,
    },
  };
}

function seriesTrend(rows, window = 7) {
  const values = (Array.isArray(rows) ? rows : []).map((row) => toNumber(Array.isArray(row) ? row[1] : row?.value ?? row?.totalLiquidityUSD)).filter(isValidNumber);
  if (values.length < window * 2) return null;
  const average = (items) => items.reduce((sum, value) => sum + value, 0) / items.length;
  const recent = average(values.slice(-window));
  const previous = average(values.slice(-window * 2, -window));
  return previous > 0 ? ((recent - previous) / previous) * 100 : null;
}
function trendState(value, threshold = 5) { if (!isValidNumber(value)) return "unknown"; if (value >= threshold) return "up"; if (value <= -threshold) return "down"; return "flat"; }
function buildFinancialSummary(live) {
  const appFees = trendState(seriesTrend(live?.charts?.appFeesHistory));
  const chainFees = trendState(seriesTrend(live?.charts?.chainFeesHistory));
  const dex = trendState(seriesTrend(live?.charts?.dexHistory));
  const ratio = live?.valuation?.volumeMarketCap;
  const liquidity = isValidNumber(ratio) ? ` Суточный торговый объем составляет ${ratio.toFixed(1)}% капитализации и дополняет оценку ликвидности.` : " Данных по отношению объема к капитализации недостаточно, поэтому оценка ликвидности остается осторожной.";
  if (appFees === "unknown" || chainFees === "unknown" || dex === "unknown") return `Доступных рядов недостаточно для уверенной оценки денежной активности. Вывод следует считать предварительным до восстановления данных по комиссиям и DEX-обороту.${liquidity}`;
  if (appFees === "up" && chainFees === "up" && dex === "up") return `Комиссии приложений, сетевые комиссии и DEX-оборот растут согласованно, указывая на усиление спроса на блокспейс и on-chain ликвидность.${liquidity}`;
  if (appFees === "down" && chainFees === "down" && dex === "down") return `Комиссии приложений, сетевые комиссии и DEX-оборот одновременно снижаются, поэтому качество текущей денежной активности требует осторожной оценки.${liquidity}`;
  if (new Set([appFees, chainFees, dex]).size > 1 && [appFees, chainFees, dex].includes("up") && [appFees, chainFees, dex].includes("down")) return `Комиссии приложений, сетевые комиссии и DEX-оборот движутся разнонаправленно: активность сохраняется, но пока не формирует единый сильный сигнал.${liquidity}`;
  return `Комиссии приложений, сетевые комиссии и DEX-оборот остаются без согласованного сильного импульса. Для улучшения оценки нужен устойчивый совместный рост обеих метрик.${liquidity}`;
}
function buildCapitalSummary(live) {
  const tvl = trendState(seriesTrend(live?.charts?.tvlHistory, 14), 3);
  const stable = trendState(seriesTrend(live?.charts?.stableHistory, 14), 3);
  const rwa = isValidNumber(live?.capital?.rwaActiveMcap)
    ? ` Активные RWA объемом ${formatMoney(live.capital.rwaActiveMcap)} дополняют картину глубиной токенизированных реальных активов.`
    : " Данные по активным RWA сейчас недоступны, поэтому глубина токенизированных реальных активов не включена в итоговую оценку.";
  if (tvl === "unknown") return `Данных по динамике TVL недостаточно для уверенного вывода. Размер DeFi-капитала следует оценивать вместе с расчетной ликвидностью стейблкоинов и последующими потоками.${rwa}`;
  if (tvl === "up" && stable !== "down") return `DeFi-капитал расширяется, а расчетная ликвидность стейблкоинов поддерживает это движение. Такая связка укрепляет общую капитализацию экосистемы.${rwa}`;
  if (tvl === "down") return `TVL указывает на отток DeFi-капитала; стабильная расчетная ликвидность смягчает риск, но не заменяет восстановление потоков.${rwa}`;
  return `DeFi-капитал остается относительно стабильным без выраженного направления, при этом стейблкоины поддерживают расчетную ликвидность сети.${rwa}`;
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

export function mergeLiveMetrics(report, live) {
  const sourceCG = live.market?.source || "CoinGecko";
  const sourceDL = "DefiLlama";

  if (isValidNumber(live.market.price)) report.market.price = liveMetric(live.market.price, formatPrice(live.market.price), sourceCG);
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
    const metric = liveMetric(live.market.circulatingSupply, formatCompactNumber(live.market.circulatingSupply), sourceCG);
    report.market.circulating_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.circulating_supply = metric;
  }
  if (isValidNumber(live.market.totalSupply)) {
    const metric = liveMetric(live.market.totalSupply, formatCompactNumber(live.market.totalSupply), sourceCG);
    report.market.total_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.total_supply = metric;
  }
  if (isValidNumber(live.market.maxSupply)) {
    const metric = liveMetric(live.market.maxSupply, formatCompactNumber(live.market.maxSupply), sourceCG);
    report.market.max_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.max_supply = metric;
  }
  if (isValidNumber(live.capital.tvl)) report.capital.metrics.tvl = liveMetric(live.capital.tvl, formatMoney(live.capital.tvl), sourceDL);
  if (isValidNumber(live.capital.stablecoins)) report.capital.metrics.stablecoins_mcap = liveMetric(live.capital.stablecoins, formatMoney(live.capital.stablecoins), sourceDL);
  report.capital.metrics.rwa_active_mcap = isValidNumber(live.capital.rwaActiveMcap)
    ? liveMetric(live.capital.rwaActiveMcap, formatMoney(live.capital.rwaActiveMcap), live.capital.rwaSource || "DefiLlama RWA", live.capital.rwaUpdatedAt)
    : unavailableMetric("DefiLlama RWA");
  if (isValidNumber(live.financials.appFees24h)) report.financials.metrics.app_fees_24h = liveMetric(live.financials.appFees24h, formatMoney(live.financials.appFees24h), sourceDL);
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
  if (isValidNumber(live.valuation.annualizedChainFeesMarketCap)) report.valuation.metrics.annualized_chain_fees_market_cap = calcMetric(live.valuation.annualizedChainFeesMarketCap, `${live.valuation.annualizedChainFeesMarketCap.toFixed(2)}%`);
  if (isValidNumber(live.valuation.annualizedAppFeesMarketCap)) report.valuation.metrics.annualized_app_fees_market_cap = calcMetric(live.valuation.annualizedAppFeesMarketCap, `${live.valuation.annualizedAppFeesMarketCap.toFixed(2)}%`);
  if (isValidNumber(live.valuation.dexVolumeMarketCap)) report.valuation.metrics.dex_volume_market_cap = calcMetric(live.valuation.dexVolumeMarketCap, `${live.valuation.dexVolumeMarketCap.toFixed(2)}%`);
  mergeBitcoinMetrics(report, live);
  if (live.charts.priceHistory?.length) report.charts.price_history = live.charts.priceHistory;
  if (live.charts.volumeHistory?.length) report.charts.volume_history = live.charts.volumeHistory;
  if (live.charts.marketCapHistory?.length) report.charts.market_cap_history = live.charts.marketCapHistory;
  if (live.charts.tvlHistory?.length) report.charts.tvl_history = live.charts.tvlHistory;
  if (live.charts.stableHistory?.length) report.charts.stablecoins_history = live.charts.stableHistory;
  if (live.charts.appFeesHistory?.length) report.charts.app_fees_history = live.charts.appFeesHistory;
  if (live.charts.chainFeesHistory?.length) report.charts.chain_fees_history = live.charts.chainFeesHistory;
  if (live.charts.dexHistory?.length) report.charts.dex_history = live.charts.dexHistory;
  if (live.charts.mvrvHistory?.length) report.charts.mvrv_history = live.charts.mvrvHistory;
  if (live.charts.realizedPriceHistory?.length) report.charts.realized_price_history = live.charts.realizedPriceHistory;
  if (live.charts.btcMarketPriceHistory?.length) report.charts.btc_market_price_history = live.charts.btcMarketPriceHistory;
  if (live.charts.issuanceHistory?.length) report.charts.issuance_history = live.charts.issuanceHistory;
  if (live.charts.btcEtfFlowHistory?.length) report.charts.btc_etf_flow_history = live.charts.btcEtfFlowHistory;
  if (live.charts.btcEtfCumulativeHistory?.length) report.charts.btc_etf_cumulative_history = live.charts.btcEtfCumulativeHistory;
  mergeUsersMetrics(report, live.users);
  if (live.technicalBias) report.technical_bias = live.technicalBias;
  report.news = live.news || { status:"unavailable", items:[], source_summary:"All configured news sources are temporarily unavailable", updated_at:new Date().toISOString(), debug:{ sources:[] } };
  report.financials.conclusion = buildFinancialSummary(live);
  report.capital.conclusion = buildCapitalSummary(live);
  sanitizeUsersBlock(report, live.users);
}

function mergeBitcoinMetrics(report, live) {
  if (!live?.btc) return;
  const source = live.btc.valuationSource || "Coin Metrics Community API";
  report.valuation = report.valuation || { text:[], metrics:{} };
  report.valuation.metrics = report.valuation.metrics || {};
  report.tokenomics = report.tokenomics || { text:[], metrics:{} };
  report.tokenomics.metrics = report.tokenomics.metrics || {};
  report.demand_flows = report.demand_flows || { text:[], metrics:{} };
  report.demand_flows.metrics = report.demand_flows.metrics || {};
  if (isValidNumber(live.btc.mvrv)) report.valuation.metrics.mvrv = liveMetric(live.btc.mvrv, `${live.btc.mvrv.toFixed(2)}x`, source);
  if (isValidNumber(live.btc.realizedPrice)) report.valuation.metrics.realized_price = liveMetric(live.btc.realizedPrice, formatMoney(live.btc.realizedPrice), source);
  if (isValidNumber(live.btc.nupl)) report.valuation.metrics.nupl = calcMetric(live.btc.nupl, `${(live.btc.nupl * 100).toFixed(1)}%`);
  if (isValidNumber(live.btc.annualIssuancePercent)) report.tokenomics.metrics.issuance_rate = liveMetric(live.btc.annualIssuancePercent, `${live.btc.annualIssuancePercent.toFixed(2)}%`, source);
  const circulatingShare = isValidNumber(live.market?.circulatingSupply) ? live.market.circulatingSupply / 21_000_000 * 100 : null;
  if (isValidNumber(circulatingShare)) report.tokenomics.metrics.circulating_share = calcMetric(circulatingShare, `${circulatingShare.toFixed(2)}%`);
  if (isValidNumber(live.btc.dominance)) report.demand_flows.metrics.btc_dominance = liveMetric(live.btc.dominance, `${live.btc.dominance.toFixed(1)}%`, "CoinGecko Global");
  const etfSource = live.btc.etfSource || "Farside Investors";
  if (isValidNumber(live.btc.etf?.latestNetFlow)) report.demand_flows.metrics.etf_latest_net_flow = liveMetric(live.btc.etf.latestNetFlow, formatMoney(live.btc.etf.latestNetFlow), etfSource, live.btc.etf.updatedAt);
  if (isValidNumber(live.btc.etf?.recentFiveDayNet)) report.demand_flows.metrics.etf_five_day_net_flow = liveMetric(live.btc.etf.recentFiveDayNet, formatMoney(live.btc.etf.recentFiveDayNet), etfSource, live.btc.etf.updatedAt);
  if (isValidNumber(live.btc.etf?.cumulativeNetFlow)) report.demand_flows.metrics.etf_cumulative_net_flow = liveMetric(live.btc.etf.cumulativeNetFlow, formatMoney(live.btc.etf.cumulativeNetFlow), etfSource, live.btc.etf.updatedAt);
  const flow = live.btc.etf?.recentFiveDayNet;
  const valuation = live.btc.mvrv;
  if (isValidNumber(flow) || isValidNumber(valuation)) {
    const flowText = isValidNumber(flow) ? `Суммарный net flow spot BTC ETF за последние пять торговых дней: ${formatMoney(flow)}.` : "ETF-потоки временно недоступны.";
    const valuationText = isValidNumber(valuation) ? ` MVRV ${valuation.toFixed(2)}x показывает положение цены относительно realized cap.` : "";
    report.demand_flows.conclusion = `${flowText}${valuationText}`;
  }
}

function applyBlockRenderingRules(report, project, live){
  if (!report?.meta) return;
  const usersState = live?.users || null;
  report.meta.features = {
    ...(report.meta.features || {}),
    usersBlock: shouldRenderUsersBlock(report, project, usersState),
    hideExecutiveSummary: Boolean(project?.reportOptions?.hideExecutiveSummary),
    compactTokenomics: Boolean(project?.reportOptions?.compactTokenomics),
    integratedFinancials: Boolean(project?.reportOptions?.integratedFinancials),
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
function liveMetric(value, formatted, source, updated_at = new Date().toISOString()){ return { value, formatted, status:"live", source, updated_at }; }
function calcMetric(value, formatted){ return { value, formatted, status:"calculated", source:"calc", updated_at:new Date().toISOString() }; }
function unavailableMetric(source){ return { value:null, formatted:"—", status:"unavailable", source, updated_at:new Date().toISOString() }; }
function safeDivide(a,b){ if (!isValidNumber(a) || !isValidNumber(b) || b===0) return null; return a/b; }
function safePercent(a,b){ if (!isValidNumber(a) || !isValidNumber(b) || b===0) return null; return (a/b)*100; }
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
export async function fetchCoinGeckoMarket(id){
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
  if (marketRow && hasAnyCoinGeckoMarketValue(marketRow)) {
    if (hasCompleteCoinGeckoTokenomics(marketRow)) return marketRow;
    try {
      return mergeCoinGeckoMarketData(marketRow, await fetchCoinGeckoMarketFallback(id));
    } catch {
      // A usable primary response is preferable to rejecting all market metrics.
      return marketRow;
    }
  }
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
const COINGECKO_MARKET_FIELDS = ["current_price", "market_cap", "fully_diluted_valuation", "total_volume", "circulating_supply", "total_supply", "max_supply"];
const COINGECKO_TOKENOMICS_FIELDS = ["market_cap", "fully_diluted_valuation", "circulating_supply", "total_supply"];

export function mergeCoinGeckoMarketData(primary, fallback) {
  if (!hasAnyCoinGeckoMarketValue(primary) && !hasAnyCoinGeckoMarketValue(fallback)) return null;
  return Object.fromEntries(COINGECKO_MARKET_FIELDS.map((field) => {
    const primaryValue = toNumber(primary?.[field]);
    const fallbackValue = toNumber(fallback?.[field]);
    return [field, isValidNumber(primaryValue) ? primaryValue : fallbackValue];
  }));
}

function hasCompleteCoinGeckoTokenomics(row) {
  return COINGECKO_TOKENOMICS_FIELDS.every((field) => isValidNumber(toNumber(row?.[field])));
}

function hasAnyCoinGeckoMarketValue(row) {
  return COINGECKO_MARKET_FIELDS.some((key) => isValidNumber(toNumber(row?.[key])));
}
function hasCoreCoinGeckoMarketValue(row) {
  return ["current_price", "market_cap", "total_volume"].every((key) => {
    const value = toNumber(row?.[key]);
    return isValidNumber(value) && value > 0;
  });
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
async function fetchAppFeesOverview(chain){ const res = await fetch(`https://api.llama.fi/overview/fees/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees`); if(!res.ok) throw new Error(`DefiLlama app fees error: ${res.status}`); return res.json(); }
async function fetchChainFeesOverview(chain){ const res = await fetch(`https://api.llama.fi/summary/fees/${encodeURIComponent(String(chain).toLowerCase())}?dataType=dailyFees&excludeTotalDataChart=false`); if(!res.ok) throw new Error(`DefiLlama chain fees error: ${res.status}`); return res.json(); }
async function fetchDexOverview(chain){ const res = await fetch(`https://api.llama.fi/overview/dexs/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`); if(!res.ok) throw new Error(`DefiLlama dex error: ${res.status}`); return res.json(); }
async function fetchTVLHistory(chain){
  const chainSlug = String(chain || "").toLowerCase();
  const primary = await fetch(`https://api.llama.fi/v2/historicalChainTvl/${encodeURIComponent(chainSlug)}`);
  if (primary.ok) return primary.json();
  const fallback = await fetch(`https://api.llama.fi/charts/${encodeURIComponent(chain)}`);
  if (!fallback.ok) throw new Error(`DefiLlama TVL history error: ${primary.status}/${fallback.status}`);
  return fallback.json();
}
function findChainData(chains, chainName){ return Array.isArray(chains) ? chains.find((item) => String(item.name).toLowerCase() === String(chainName).toLowerCase()) : null; }
function findStableChainData(chains, chainKey){ const target = String(chainKey || "").toLowerCase(); return Array.isArray(chains) ? chains.find((item) => [item?.gecko_id,item?.name,item?.chain,item?.tokenSymbol].filter(Boolean).map((v)=>String(v).toLowerCase()).includes(target)) : null; }
function extractStablecoinsCurrent(chainNow, stableNow){
  const fromChain = toNumber(chainNow?.stablecoins ?? chainNow?.stablecoinMcap ?? chainNow?.stablecoinsMcap ?? chainNow?.stables);
  if (isValidNumber(fromChain)) return fromChain;
  const fromStablecoinChain = stablecoinMcapUsd(stableNow);
  if (isValidNumber(fromStablecoinChain)) return fromStablecoinChain;
  return null;
}
function getLastTVL(rows){ if(!Array.isArray(rows) || !rows.length) return null; return toNumber(rows[rows.length-1]?.totalLiquidityUSD); }
function getLastStable(rows){ if(!Array.isArray(rows) || !rows.length) return null; return stablecoinMcapUsd(rows[rows.length-1]); }
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
  return dataStatus === "hybrid-live"
    ? "public, max-age=120, s-maxage=120, stale-while-revalidate=900"
    : "public, max-age=60, s-maxage=120, stale-while-revalidate=900";
}
function json(data,status=200,{ cacheControl = "public, max-age=300" } = {}){ return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":cacheControl}}); }
