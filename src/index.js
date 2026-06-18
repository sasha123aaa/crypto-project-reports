import { getSectionSelection } from "./config/projects.js";
import { resolveProject } from "./lib/project-resolution.js";
import { buildReport } from "./lib/build-report.js";
import { buildReportShell } from "./lib/report-shell.js";
import { applySectionSelection, isSectionSelected } from "./lib/section-selection.js";
import { activeRangeForCandles, analysisCandlesForRange, detectRangesWithPreview, fetchMarketCandlesWithFallback, fetchBybitSpotUsdtUniverse, getTechnicalBias, RANGE_PARAMS } from "./adapters/bybit.js";
import { createMarketSymbols, marketTechnicalRoutes } from "./lib/market-symbols.js";
import { fetchUsersMetrics } from "./lib/users-source.js";
import { fetchDefiLlamaRwaActiveMcap, fetchStablecoinChains, fetchStablecoinHistory, normalizeStablecoinHistory, stablecoinMcapUsd } from "./adapters/defillama.js";
import { fetchCoinGeckoGlobal, fetchProjectNews, fetchCoinGeckoMarket as fetchAdapterCoinGeckoMarket } from "./adapters/coingecko.js";
import { fetchBitcoinValuationHistory } from "./adapters/coinmetrics.js";
import { fetchBitcoinEtfFlows } from "./adapters/farside.js";
import { formatCompactNumber, formatMoney, formatPrice } from "./lib/formatters.js";
import { applyProfileAwareSemantics } from "./lib/profile-semantics.js";
import { orchestrateReportSources, publishReportReadiness } from "./lib/report-readiness.js";
import { brandingFromCoinGeckoAsset, isHttpsUrl, mergeBranding } from "./lib/branding.js";
export { mergeBranding } from "./lib/branding.js";
import { getCachedReport, getFallbackReport, getPersistentReport, getPersistentResolution, REPORT_CACHE_VERSION, responseFromSnapshot, responseSnapshot, runSingleFlight, setCachedReport, setPersistentReport, setPersistentResolution } from "./lib/report-cache.js";
import { buildStrategyPlan, evaluateVirtualTrade } from "../public/assets/strategy-engine.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/strategy/plan") return handleStrategyPlanApi(url, env);
    if (url.pathname === "/api/strategy/trades") return handleStrategyTradesApi(url, env);
    if (url.pathname === "/api/strategy/stats") return handleStrategyStatsApi(url, env);
    if (url.pathname === "/api/strategy/active") return handleStrategyActiveApi(env);
    if (url.pathname === "/api/strategy/status") return handleStrategyStatusApi(env);
    if (url.pathname === "/api/strategy/run-monitor") return handleStrategyRunMonitorApi(request, env);
    if (url.pathname === "/api/bull-radar") {
      return handleBullRadarApi(url);
    }
    if (url.pathname === "/api/radar-chart-candles") {
      return handleRadarChartCandles(url);
    }
    if (url.pathname.startsWith("/api/trade-plan-candles/")) {
      return handleTradePlanCandles(url);
    }
    if (url.pathname.startsWith("/api/report-shell/")) {
      return handleReportShellApi(request, env, url);
    }
    if (url.pathname.startsWith("/api/report/")) {
      return handleHybridReportApi(request, env, url, ctx);
    }
    return env.ASSETS.fetch(request);
  },
  async scheduled(event, env, ctx) {
    if (!hasStrategyDb(env)) {
      console.log("Strategy DB is not configured. Skipping scheduled strategy monitor.");
      return;
    }
    ctx.waitUntil(runStrategyMonitorBatch(env));
  },
};


const STRATEGY_TIMEFRAMES = ["15m", "1h", "4h", "1d"];
const STRATEGY_ENTRY_MODES = [0.31, 0.5, 0.75];
const STRATEGY_BATCH_SIZE = 20;

function strategyDb(env) { return env?.DB || env?.STRATEGY_DB || null; }
function hasStrategyDb(env) { return !!strategyDb(env); }
function strategyDbUnavailable() {
  return jsonResponse({
    ok:false,
    available:false,
    reason:"D1 database is not configured",
    message:"Память стратегии пока не подключена. Создайте D1 и добавьте database_id в wrangler.toml."
  }, { status:200 });
}
function baseFromSymbol(symbol) { return String(symbol || "").toUpperCase().replace(/USDT$/, ""); }
function strategyTradeId({ symbol, exchange, timeframe, entryMode, range }) {
  return [exchange, symbol, timeframe, entryMode, range?.aTime || "a", range?.bTime || "b"].join(":");
}
function rowToTrade(row) {
  return {
    id:row.id, symbol:row.symbol, baseSymbol:row.base_symbol, exchange:row.exchange, timeframe:row.timeframe,
    direction:row.direction, entryMode:row.entry_mode, range:JSON.parse(row.range_json || "null"), levels:JSON.parse(row.levels_json || "[]"),
    status:row.status, openedAt:row.opened_at, updatedAt:row.updated_at, closedAt:row.closed_at,
    entryPrice:row.entry_price, averagePrice:row.average_price, takePrice:row.take_price, currentPrice:row.current_price,
    activatedLevels:row.activated_levels, usedCapitalPct:row.used_capital_pct, maxDrawdownPct:row.max_drawdown_pct,
    currentPnlPct:row.current_pnl_pct, resultPct:row.result_pct, resultOnFullCapitalPct:row.result_on_full_capital_pct,
  };
}
function tradeParams(trade) {
  return [trade.id, trade.symbol, trade.baseSymbol, trade.exchange, trade.timeframe, trade.direction, trade.entryMode,
    JSON.stringify(trade.range), JSON.stringify(trade.levels), trade.status, trade.openedAt, trade.updatedAt, trade.closedAt,
    trade.entryPrice, trade.averagePrice, trade.takePrice, trade.currentPrice, trade.activatedLevels, trade.usedCapitalPct,
    trade.maxDrawdownPct, trade.currentPnlPct, trade.resultPct, trade.resultOnFullCapitalPct];
}
async function putTrade(db, trade) {
  await db.prepare(`INSERT OR REPLACE INTO virtual_trades (id,symbol,base_symbol,exchange,timeframe,direction,entry_mode,range_json,levels_json,status,opened_at,updated_at,closed_at,entry_price,average_price,take_price,current_price,activated_levels,used_capital_pct,max_drawdown_pct,current_pnl_pct,result_pct,result_on_full_capital_pct) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(...tradeParams(trade)).run();
}

async function getMonitorState(db) {
  const row = await db.prepare(
    `SELECT value_json FROM strategy_monitor_state WHERE key='main' LIMIT 1`
  ).first().catch(() => null);

  try {
    return row?.value_json ? JSON.parse(row.value_json) : {};
  } catch {
    return {};
  }
}

async function putMonitorState(db, state) {
  await db.prepare(
    `INSERT OR REPLACE INTO strategy_monitor_state (key,value_json,updated_at) VALUES ('main',?,?)`
  ).bind(JSON.stringify(state), new Date().toISOString()).run();
}

async function addTradeEvent(db, tradeId, eventType, price, levelIndex = null, payload = {}) {
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO virtual_trade_events (id,trade_id,event_type,event_time,price,level_index,payload_json) VALUES (?,?,?,?,?,?,?)`).bind(`${tradeId}:${eventType}:${Date.now()}:${Math.random().toString(16).slice(2)}`, tradeId, eventType, now, price, levelIndex, JSON.stringify(payload)).run();
}
function chartTradePayload(trade) {
  if (!trade) return null;
  return { id:trade.id, status:trade.status, entryMode:trade.entryMode, averagePrice:trade.averagePrice, takePrice:trade.takePrice, currentPrice:trade.currentPrice, usedCapitalPct:trade.usedCapitalPct, activatedLevels:trade.activatedLevels, maxDrawdownPct:trade.maxDrawdownPct, currentPnlPct:trade.currentPnlPct,
    levels:(trade.levels || []).map((level, index) => ({ label:index === 0 ? "Вход" : `Уср. ${index}`, price:level.price, state:index < Number(trade.activatedLevels || 0) ? "filled" : "waiting" })) };
}
async function buildStrategyPlanForMarket({ symbol, exchange = "BYBIT", timeframe = "4h", entryMode = 0.5 }) {
  const routes = [{ exchange, symbol, source:`${exchange} spot` }];
  const candleResult = await fetchMarketCandlesWithFallback(routes, timeframe, { minCandles:50, timeoutMs:4500 });
  if (!candleResult.route || !candleResult.candles.length) throw new Error("Candles unavailable");
  const rangeData = activePreviewRangeForCandles(candleResult.candles);
  const range = rangePayload(rangeData.range, rangeData.analysisCandles);
  const currentPrice = Number(candleResult.candles.at(-1)?.close);
  const plan = range?.bullish ? buildStrategyPlan({ range, entryMode, currentPrice, candles:candleResult.candles, capital:100 }) : null;
  return { symbol:candleResult.symbol, exchange:candleResult.exchange, timeframe, range, currentPrice, candles:candleResult.candles, plan, activeTrade:null, updated_at:new Date().toISOString() };
}
async function handleStrategyPlanApi(url, env) {
  try {
    const base = String(url.searchParams.get("symbol") || "").toUpperCase().replace(/USDT$/, "");
    const symbol = `${base}USDT`;
    if (!base) return json({ error:"Missing symbol" }, 400, { cacheControl:"no-store" });
    const payload = await buildStrategyPlanForMarket({ symbol, exchange:String(url.searchParams.get("exchange") || "BYBIT").toUpperCase(), timeframe:url.searchParams.get("timeframe") || "4h", entryMode:Number(url.searchParams.get("entryMode") || 0.5) });
    payload.ok = true;
    payload.dbAvailable = hasStrategyDb(env);
    payload.activeTrade = null;
    const db = strategyDb(env);
    if (db) {
      const row = await db.prepare(`SELECT * FROM virtual_trades WHERE symbol=? AND timeframe=? AND exchange=? AND entry_mode=? AND status IN ('active','averaging','drawdown') ORDER BY updated_at DESC LIMIT 1`).bind(payload.symbol, payload.timeframe, payload.exchange, Number(url.searchParams.get("entryMode") || 0.5)).first().catch(() => null);
      payload.activeTrade = chartTradePayload(row ? rowToTrade(row) : null);
    }
    return json(payload, 200, { cacheControl:"no-store" });
  } catch (error) { return json({ error:"Strategy plan unavailable", reason:error.message }, 502, { cacheControl:"no-store" }); }
}
async function handleStrategyTradesApi(url, env) {
  const db = strategyDb(env); if (!db) return strategyDbUnavailable();
  const symbol = String(url.searchParams.get("symbol") || "").toUpperCase();
  const stmt = symbol ? db.prepare(`SELECT * FROM virtual_trades WHERE base_symbol=? OR symbol=? ORDER BY updated_at DESC LIMIT 100`).bind(baseFromSymbol(symbol), symbol.endsWith("USDT") ? symbol : `${symbol}USDT`) : db.prepare(`SELECT * FROM virtual_trades ORDER BY updated_at DESC LIMIT 100`);
  const res = await stmt.all(); return json({ trades:(res.results || []).map(rowToTrade) }, 200, { cacheControl:"no-store" });
}
async function handleStrategyActiveApi(env) {
  const db = strategyDb(env); if (!db) return strategyDbUnavailable();
  const res = await db.prepare(`SELECT * FROM virtual_trades WHERE status IN ('active','averaging','drawdown') ORDER BY updated_at DESC`).all();
  return json({ trades:(res.results || []).map(rowToTrade) }, 200, { cacheControl:"no-store" });
}

async function handleStrategyStatusApi(env) {
  const db = strategyDb(env);
  const baseMonitorState = {
    lastRunAt:null,
    totalJobs:0,
    processedJobs:0,
    batchSize:STRATEGY_BATCH_SIZE,
    timeframes:STRATEGY_TIMEFRAMES,
    entryModes:STRATEGY_ENTRY_MODES,
    lastError:null,
  };

  if (!db) {
    return json({
      ok:true,
      dbAvailable:false,
      monitorActive:false,
      message:"D1 database is not configured. Strategy memory works only as live plan calculation.",
      monitorState:baseMonitorState,
      totals:{
        totalTrades:0,
        activeTrades:0,
        takeHits:0,
        drawdownTrades:0,
      },
    }, 200, { cacheControl:"no-store" });
  }

  const monitorState = { ...baseMonitorState, ...(await getMonitorState(db)) };

  const active = await db.prepare(
    `SELECT COUNT(*) AS count FROM virtual_trades WHERE status IN ('active','averaging','drawdown')`
  ).first().catch(() => ({ count:0 }));

  const total = await db.prepare(
    `SELECT COUNT(*) AS count FROM virtual_trades`
  ).first().catch(() => ({ count:0 }));

  const takes = await db.prepare(
    `SELECT COUNT(*) AS count FROM virtual_trades WHERE status='take_hit'`
  ).first().catch(() => ({ count:0 }));

  const drawdown = await db.prepare(
    `SELECT COUNT(*) AS count FROM virtual_trades WHERE status='drawdown'`
  ).first().catch(() => ({ count:0 }));

  return json({
    ok:true,
    dbAvailable:true,
    monitorActive:true,
    monitorState,
    totals:{
      totalTrades:Number(total?.count || 0),
      activeTrades:Number(active?.count || 0),
      takeHits:Number(takes?.count || 0),
      drawdownTrades:Number(drawdown?.count || 0),
    },
  }, 200, { cacheControl:"no-store" });
}

async function handleStrategyRunMonitorApi(request, env) {
  const url = new URL(request.url);
  const adminKey = env.STRATEGY_ADMIN_KEY;
  const providedKey = url.searchParams.get("key") || request.headers.get("x-strategy-admin-key");

  if (!adminKey) {
    return json({ ok:false, message:"STRATEGY_ADMIN_KEY is not configured" }, 403, { cacheControl:"no-store" });
  }

  if (providedKey !== adminKey) {
    return json({ ok:false, message:"Invalid strategy admin key" }, 403, { cacheControl:"no-store" });
  }

  if (!env.DB) {
    return json({ ok:false, dbAvailable:false, message:"D1 database is not configured" }, 200, { cacheControl:"no-store" });
  }

  try {
    const result = await runStrategyMonitorBatch(env);
    return json({ ok:true, dbAvailable:true, result }, 200, { cacheControl:"no-store" });
  } catch (error) {
    return json({ ok:false, dbAvailable:true, message:error?.message || "Strategy monitor failed" }, 500, { cacheControl:"no-store" });
  }
}

async function handleStrategyStatsApi(url, env) {
  const db = strategyDb(env); if (!db) return strategyDbUnavailable();
  const symbol = String(url.searchParams.get("symbol") || "").toUpperCase();
  const stmt = symbol ? db.prepare(`SELECT * FROM strategy_stats WHERE symbol=? ORDER BY timeframe, entry_mode`).bind(baseFromSymbol(symbol)) : db.prepare(`SELECT * FROM strategy_stats ORDER BY symbol, timeframe, entry_mode`);
  const res = await stmt.all(); return json({ stats:res.results || [] }, 200, { cacheControl:"no-store" });
}
async function runStrategyMonitorBatch(env) {
  const db = strategyDb(env); if (!db) {
    console.log("Strategy DB is not configured. Skipping scheduled strategy monitor.");
    return;
  }
  let universe = [];
  let jobs = [];
  let batch = [];
  let nextOffset = 0;
  try {
    universe = await fetchBybitSpotUsdtUniverse({ minTurnover24h:1_000_000, maxUniverse:200 });
    jobs = universe.flatMap((asset) => STRATEGY_TIMEFRAMES.map((timeframe) => ({ asset, timeframe })));
    const monitorState = await getMonitorState(db);
    const offset = Math.max(0, Number(monitorState?.offset) || 0);
    batch = jobs.slice(offset, offset + STRATEGY_BATCH_SIZE);
    for (const job of batch) await processStrategyJob(db, job).catch((error) => console.log("Strategy monitor job failed", error?.message || error));
    nextOffset = offset + batch.length >= jobs.length ? 0 : offset + batch.length;
    const state = {
      lastRunAt:new Date().toISOString(),
      offset:nextOffset,
      totalJobs:jobs.length,
      batchSize:STRATEGY_BATCH_SIZE,
      processedJobs:batch.length,
      timeframes:STRATEGY_TIMEFRAMES,
      entryModes:STRATEGY_ENTRY_MODES,
      universeSize:universe.length,
      lastError:null,
    };
    await putMonitorState(db, state);
    return state;
  } catch (error) {
    await putMonitorState(db, {
      ...(await getMonitorState(db)),
      lastRunAt:new Date().toISOString(),
      offset:nextOffset,
      totalJobs:jobs.length,
      batchSize:STRATEGY_BATCH_SIZE,
      processedJobs:batch.length,
      timeframes:STRATEGY_TIMEFRAMES,
      entryModes:STRATEGY_ENTRY_MODES,
      universeSize:universe.length,
      lastError:error?.message || String(error),
    }).catch(() => {});
    throw error;
  }
}
async function processStrategyJob(db, { asset, timeframe }) {
  const built = await buildStrategyPlanForMarket({ symbol:asset.symbol, exchange:"BYBIT", timeframe, entryMode:0.5 });
  if (!built.plan || !built.range?.bullish) return;
  for (const entryMode of STRATEGY_ENTRY_MODES) {
    const plan = buildStrategyPlan({ range:built.range, entryMode, currentPrice:built.currentPrice, candles:built.candles, capital:100 });
    const id = strategyTradeId({ symbol:asset.symbol, exchange:"BYBIT", timeframe, entryMode, range:built.range });
    const existing = await db.prepare(`SELECT * FROM virtual_trades WHERE id=?`).bind(id).first();
    if (!existing && plan.activatedLevels <= 0) continue;
    const oldTrade = existing ? rowToTrade(existing) : { id, symbol:asset.symbol, baseSymbol:asset.ticker, exchange:"BYBIT", timeframe, direction:"long", entryMode, range:built.range, levels:plan.levels, status:"active", openedAt:new Date().toISOString(), maxDrawdownPct:0 };
    const updated = evaluateVirtualTrade({ trade:{ ...oldTrade, levels:plan.levels, range:built.range }, candles:built.candles, currentPrice:built.currentPrice });
    updated.updatedAt = new Date().toISOString();
    if (updated.status === "take_hit" && !updated.closedAt) updated.closedAt = updated.updatedAt;
    updated.entryPrice = updated.entryPrice || plan.levels[0]?.price || null;
    await putTrade(db, updated);
    if (!existing) await addTradeEvent(db, id, "opened", built.currentPrice, 0, { entryMode, timeframe });
    const previousActivated = Number(oldTrade.activatedLevels || 0);
    const nextActivated = Number(updated.activatedLevels || 0);
    if (nextActivated > previousActivated) {
      for (let i = previousActivated; i < nextActivated; i++) {
        await addTradeEvent(db, id, "level_filled", built.currentPrice, i, updated.levels?.[i] || {});
      }
    }
    if (updated.status === "drawdown" && oldTrade.status !== "drawdown") await addTradeEvent(db, id, "drawdown", built.currentPrice, null, updated);
    if (updated.status === "take_hit" && oldTrade.status !== "take_hit") await addTradeEvent(db, id, "take_hit", built.currentPrice, null, updated);
    await refreshStrategyStats(db, asset.ticker, timeframe, entryMode, "BYBIT");
  }
}
async function refreshStrategyStats(db, symbol, timeframe, entryMode, exchange) {
  const rows = (await db.prepare(`SELECT * FROM virtual_trades WHERE base_symbol=? AND timeframe=? AND entry_mode=? AND exchange=?`).bind(symbol, timeframe, entryMode, exchange).all()).results || [];
  const total = rows.length || 0, takeHits = rows.filter(r => r.status === "take_hit").length;
  const active = rows.filter(r => ["active","averaging"].includes(r.status)).length, dd = rows.filter(r => r.status === "drawdown").length;
  const avg = (field) => { const vals = rows.map(r => Number(r[field])).filter(Number.isFinite); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null; };
  await db.prepare(`INSERT OR REPLACE INTO strategy_stats (key,symbol,timeframe,entry_mode,exchange,total_trades,take_hits,active_trades,drawdown_trades,avg_result_pct,avg_drawdown_pct,avg_time_to_take_minutes,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(`${exchange}:${symbol}:${timeframe}:${entryMode}`, symbol, timeframe, entryMode, exchange, total, takeHits, active, dd, avg("result_pct"), avg("max_drawdown_pct"), null, new Date().toISOString()).run();
}

const RADAR_UNIVERSE = [
  "BTC", "ETH", "BNB", "SOL", "LINK", "DOGE", "PEPE",
  "ALGO", "NEO", "ARB", "OP", "APT", "SUI", "TON", "NEAR",
  "INJ", "AVAX", "DOT", "JTO", "FIL", "ATOM", "MNT",
  "PENDLE", "CRV", "LDO", "ETHFI", "ZRO", "PYTH", "SEI",
  "TIA", "WLD", "ICP", "GRT", "POL", "AAVE", "UNI",
  "ENA", "ONDO", "RENDER", "FET", "RUNE", "STX", "IMX",
  "ETC", "XRP", "ADA", "HBAR", "KAS", "TRX", "LTC"
];

const RADAR_META = Object.freeze({
  BTC: { slug:"btc", ticker:"BTC", name:"Bitcoin", coingeckoId:"bitcoin" },
  ETH: { slug:"eth", ticker:"ETH", name:"Ethereum", coingeckoId:"ethereum" },
  BNB: { slug:"bnb", ticker:"BNB", name:"BNB", coingeckoId:"binancecoin" },
  SOL: { slug:"sol", ticker:"SOL", name:"Solana", coingeckoId:"solana" },
  LINK: { slug:"link", ticker:"LINK", name:"Chainlink", coingeckoId:"chainlink" },
  DOGE: { slug:"doge", ticker:"DOGE", name:"Dogecoin", coingeckoId:"dogecoin" },
  PEPE: { slug:"pepe", ticker:"PEPE", name:"Pepe", coingeckoId:"pepe" },
  ALGO: { slug:"algo", ticker:"ALGO", name:"Algorand", coingeckoId:"algorand" },
  NEO: { slug:"neo", ticker:"NEO", name:"NEO", coingeckoId:"neo" },
  ARB: { slug:"arb", ticker:"ARB", name:"Arbitrum", coingeckoId:"arbitrum" },
  OP: { slug:"op", ticker:"OP", name:"Optimism", coingeckoId:"optimism" },
  APT: { slug:"apt", ticker:"APT", name:"Aptos", coingeckoId:"aptos" },
  SUI: { slug:"sui", ticker:"SUI", name:"Sui", coingeckoId:"sui" },
  TON: { slug:"ton", ticker:"TON", name:"Toncoin", coingeckoId:"the-open-network" },
  NEAR: { slug:"near", ticker:"NEAR", name:"NEAR Protocol", coingeckoId:"near" },
  INJ: { slug:"inj", ticker:"INJ", name:"Injective", coingeckoId:"injective-protocol" },
  AVAX: { slug:"avax", ticker:"AVAX", name:"Avalanche", coingeckoId:"avalanche-2" },
  DOT: { slug:"dot", ticker:"DOT", name:"Polkadot", coingeckoId:"polkadot" },
  JTO: { slug:"jto", ticker:"JTO", name:"Jito", coingeckoId:"jito-governance-token" },
  FIL: { slug:"fil", ticker:"FIL", name:"Filecoin", coingeckoId:"filecoin" },
  ATOM: { slug:"atom", ticker:"ATOM", name:"Cosmos", coingeckoId:"cosmos" },
  MNT: { slug:"mnt", ticker:"MNT", name:"Mantle", coingeckoId:"mantle" },
  PENDLE: { slug:"pendle", ticker:"PENDLE", name:"Pendle", coingeckoId:"pendle" },
  CRV: { slug:"crv", ticker:"CRV", name:"Curve DAO", coingeckoId:"curve-dao-token" },
  LDO: { slug:"ldo", ticker:"LDO", name:"Lido DAO", coingeckoId:"lido-dao" },
  ETHFI: { slug:"ethfi", ticker:"ETHFI", name:"ether.fi", coingeckoId:"ether-fi" },
  ZRO: { slug:"zro", ticker:"ZRO", name:"LayerZero", coingeckoId:"layerzero" },
  PYTH: { slug:"pyth", ticker:"PYTH", name:"Pyth Network", coingeckoId:"pyth-network" },
  SEI: { slug:"sei", ticker:"SEI", name:"Sei", coingeckoId:"sei-network" },
  TIA: { slug:"tia", ticker:"TIA", name:"Celestia", coingeckoId:"celestia" },
  WLD: { slug:"wld", ticker:"WLD", name:"Worldcoin", coingeckoId:"worldcoin-wld" },
  ICP: { slug:"icp", ticker:"ICP", name:"Internet Computer", coingeckoId:"internet-computer" },
  GRT: { slug:"grt", ticker:"GRT", name:"The Graph", coingeckoId:"the-graph" },
  POL: { slug:"pol", ticker:"POL", name:"Polygon Ecosystem Token", coingeckoId:"polygon-ecosystem-token" },
  AAVE: { slug:"aave", ticker:"AAVE", name:"Aave", coingeckoId:"aave" },
  UNI: { slug:"uni", ticker:"UNI", name:"Uniswap", coingeckoId:"uniswap" },
  ENA: { slug:"ena", ticker:"ENA", name:"Ethena", coingeckoId:"ethena" },
  ONDO: { slug:"ondo", ticker:"ONDO", name:"Ondo", coingeckoId:"ondo-finance" },
  RENDER: { slug:"render", ticker:"RENDER", name:"Render", coingeckoId:"render-token" },
  FET: { slug:"fet", ticker:"FET", name:"Artificial Superintelligence Alliance", coingeckoId:"fetch-ai" },
  RUNE: { slug:"rune", ticker:"RUNE", name:"THORChain", coingeckoId:"thorchain" },
  STX: { slug:"stx", ticker:"STX", name:"Stacks", coingeckoId:"blockstack" },
  IMX: { slug:"imx", ticker:"IMX", name:"Immutable", coingeckoId:"immutable-x" },
  ETC: { slug:"etc", ticker:"ETC", name:"Ethereum Classic", coingeckoId:"ethereum-classic" },
  XRP: { slug:"xrp", ticker:"XRP", name:"XRP", coingeckoId:"ripple" },
  ADA: { slug:"ada", ticker:"ADA", name:"Cardano", coingeckoId:"cardano" },
  HBAR: { slug:"hbar", ticker:"HBAR", name:"Hedera", coingeckoId:"hedera-hashgraph" },
  KAS: { slug:"kas", ticker:"KAS", name:"Kaspa", coingeckoId:"kaspa" },
  TRX: { slug:"trx", ticker:"TRX", name:"TRON", coingeckoId:"tron" },
  LTC: { slug:"ltc", ticker:"LTC", name:"Litecoin", coingeckoId:"litecoin" }
});
const RADAR_TIMEFRAMES = new Set(["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"]);
const RADAR_EXCHANGES = new Set(["BYBIT", "BINANCE", "GATEIO"]);

function clampNumber(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function parseCsv(value, fallback) {
  const items = String(value || "").split(",").map((x) => x.trim()).filter(Boolean);
  return items.length ? items : fallback;
}

function radarFibPrice(range, fib, logBased = false) {
  const top = Math.max(Number(range?.aPrice), Number(range?.bPrice));
  const bottom = Math.min(Number(range?.aPrice), Number(range?.bPrice));
  if (!(top > 0 && bottom > 0)) return NaN;
  if (logBased) {
    const logSize = Math.log(top) - Math.log(bottom);
    return Math.exp(range.bullish ? Math.log(top) - Number(fib) * logSize : Math.log(bottom) + Number(fib) * logSize);
  }
  const size = top - bottom;
  return range.bullish ? top - Number(fib) * size : bottom + Number(fib) * size;
}

export function buildRadarLevels(range, settings = {}) {
  const entryFib = clampNumber(settings.entryFib, 0.3, 0.99, 0.5);
  const avgFibs = (Array.isArray(settings.avgFibs) ? settings.avgFibs : [1, 1.5, 2]).map(Number).filter(Number.isFinite).slice(0, 3);
  const specs = [{ key:"take", label:"Тейк", fib:0 }, { key:"entry", label:"Вход", fib:entryFib }, ...avgFibs.map((fib, index) => ({ key:`average${index + 1}`, label:`Уср. ${index + 1}`, fib }))];
  const logBased = specs.some((spec) => radarFibPrice(range, spec.fib) <= 0);
  const take = { label:"Тейк", fib:0, value:radarFibPrice(range, 0, logBased), state:"take" };
  const entry = { label:"Вход", fib:entryFib, value:radarFibPrice(range, entryFib, logBased), state:"waiting" };
  const averages = avgFibs.map((fib, index) => ({ label:`Уср. ${index + 1}`, fib, value:radarFibPrice(range, fib, logBased), state:"waiting" }));
  return { take, entry, averages, logBased };
}

function radarStatus(price, levels, absDistanceToEntryPct) {
  const avg1 = levels.averages?.[0]?.value;
  if (absDistanceToEntryPct <= 1) return "Готово к входу";
  if (price > levels.entry.value) return "Выше входа";
  if (Number.isFinite(avg1) && price <= avg1) return "На усреднении";
  if (price < levels.entry.value && (!Number.isFinite(avg1) || price > avg1)) return "Ждем вход";
  return "Далеко от входа";
}

function planChartLevels(levels) {
  const result = { take:levels.take, entry:levels.entry };
  levels.averages.forEach((item, index) => { result[`average${index + 1}`] = item; });
  return result;
}

function rangePayload(rawRange, analysisCandles) {
  if (!rawRange) return null;
  const aIndex = rawRange[0], bIndex = rawRange[1], aPrice = Number(rawRange[2]), bPrice = Number(rawRange[3]);
  return { aTime:analysisCandles[aIndex]?.time, bTime:analysisCandles[bIndex]?.time, aPrice, bPrice, bullish:Boolean(rawRange[4]), heightPct:Math.abs((bPrice - aPrice) / aPrice) * 100, ageBars:Math.max(0, analysisCandles.length - 1 - bIndex) };
}

function lastBullishRangeForCandles(candles) {
  const analysisCandles = analysisCandlesForRange(candles);
  const result = detectRangesWithPreview(analysisCandles, RANGE_PARAMS.correctionPct, RANGE_PARAMS.maxRects, RANGE_PARAMS.minBars);
  const lastBullish = [...(result.ranges || [])].reverse().find((range) => Boolean(range[4]));
  return {
    analysisCandles,
    range:result.previewRange?.[4] ? result.previewRange : lastBullish || null,
    source:result.previewRange?.[4] ? "preview" : "last_bullish",
  };
}

function activePreviewRangeForCandles(candles) {
  const analysisCandles = analysisCandlesForRange(candles);
  const result = detectRangesWithPreview(
    analysisCandles,
    RANGE_PARAMS.correctionPct,
    RANGE_PARAMS.maxRects,
    RANGE_PARAMS.minBars
  );

  return {
    analysisCandles,
    range:result.previewRange || null,
    source:"active_preview",
  };
}

function radarAttempt(base = {}) {
  return {
    ticker:base.ticker || null,
    timeframe:base.timeframe ?? null,
    routes:base.routes || [],
    status:base.status || "error",
    reason:base.reason || null,
    exchange:base.exchange || null,
    symbol:base.symbol || null,
    candlesCount:base.candlesCount || 0,
    rangeBullish:base.rangeBullish ?? null,
    ...(base.errors ? { errors:base.errors } : {}),
    ...(base.rangeSource ? { rangeSource:base.rangeSource } : {}),
  };
}

async function mapLimit(items, limit, worker) {
  const results = [];
  const executing = new Set();

  for (const item of items) {
    const promise = Promise.resolve()
      .then(() => worker(item))
      .finally(() => executing.delete(promise));

    results.push(promise);
    executing.add(promise);

    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

function summarizeRadarAttempts(attempts) {
  return attempts.reduce((acc, attempt) => {
    const key = attempt.status || "unknown";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

async function enrichRadarRowsWithMarket(rows, limit = 20) {
  const targets = rows
    .filter((row) => row.coingeckoId)
    .slice(0, limit);

  await mapLimit(targets, 2, async (row) => {
    try {
      const market = await fetchAdapterCoinGeckoMarket(row.coingeckoId);

      row.iconUrl = market?.image || row.branding?.iconUrl || row.iconUrl || null;
      row.change24hPct = toNumber(market?.price_change_percentage_24h);
      row.volume24h = toNumber(market?.total_volume);
      row.marketCap = toNumber(market?.market_cap);
    } catch (error) {
      row.marketError = error instanceof Error ? error.message : String(error);
    }
  });

  return rows;
}

function isRadarBudgetExceeded(startedAt, maxRuntimeMs) {
  return Date.now() - startedAt >= maxRuntimeMs;
}

async function handleRadarChartCandles(url) {
  const symbol = String(url.searchParams.get("symbol") || "").toUpperCase();
  const exchange = String(url.searchParams.get("exchange") || "BYBIT").toUpperCase();
  const timeframe = String(url.searchParams.get("timeframe") || "4h");

  if (!symbol || !symbol.endsWith("USDT")) {
    return json({ error:"Missing or unsupported symbol" }, 400, { cacheControl:"no-store" });
  }

  if (!RADAR_EXCHANGES.has(exchange)) {
    return json({ error:"Unsupported exchange" }, 400, { cacheControl:"no-store" });
  }

  if (!RADAR_TIMEFRAMES.has(timeframe)) {
    return json({ error:"Unsupported timeframe" }, 400, { cacheControl:"no-store" });
  }

  try {
    const routes = [{ exchange, symbol, source:`${exchange} spot` }];
    const candleResult = await fetchMarketCandlesWithFallback(routes, timeframe, { minCandles:50, timeoutMs:4500 });
    const candles = candleResult.candles || [];

    if (!candleResult.route || !candles.length) {
      return json({ error:"Candles unavailable", symbol, exchange, timeframe, attempts:candleResult.errors || [] }, 404, { cacheControl:"no-store" });
    }

    const rangeData = activePreviewRangeForCandles(candles);
    const range = rangePayload(rangeData.range, rangeData.analysisCandles);
    const firstCandle = candles[0] || null;
    const lastCandle = candles[candles.length - 1] || null;

    return json({
      symbol:candleResult.symbol,
      exchange:candleResult.exchange,
      source:candleResult.source,
      timeframe,
      candles,
      range,
      rangeSource:rangeData.source,
      updated_at:new Date().toISOString(),
      last_candle_time:lastCandle?.time || null,
      candle_debug:{
        count:candles.length,
        first_time:firstCandle?.time || null,
        last_time:lastCandle?.time || null,
        ascending:candles.every((c, index) => index === 0 || c.time > candles[index - 1].time),
      },
    }, 200, { cacheControl:"no-store, no-cache, must-revalidate, max-age=0" });
  } catch (error) {
    return json({
      error:"Radar chart candles unavailable",
      reason:error instanceof Error ? error.message : String(error),
      symbol,
      exchange,
      timeframe,
    }, 502, { cacheControl:"no-store" });
  }
}

async function handleBullRadarApi(url) {
  const startedAt = Date.now();
  const maxRuntimeMs = 8500;
  const debug = url.searchParams.get("debug") === "1";
  const attempts = [];
  const timeframes = parseCsv(url.searchParams.get("timeframes"), ["4h"]).filter((tf) => RADAR_TIMEFRAMES.has(tf));
  const exchanges = parseCsv(url.searchParams.get("exchanges"), ["BYBIT", "BINANCE", "GATEIO"]).map((x) => x.toUpperCase()).filter((x) => RADAR_EXCHANGES.has(x));
  const rangeModeParam = String(url.searchParams.get("rangeMode") || "active");
  const rangeMode = rangeModeParam === "last_bullish" ? "last_bullish" : "active";
  const includeMarket = url.searchParams.get("includeMarket") === "1";
  const entryFib = clampNumber(url.searchParams.get("entryFib"), 0.3, 0.99, 0.5);
  const avgFibs = parseCsv(url.searchParams.get("avgFibs"), ["1", "1.5", "2"]).map(Number).filter(Number.isFinite).slice(0, 3);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 100));
  const rawMinTurnover24h = Number(url.searchParams.get("minTurnover24h") ?? 1_000_000);
  const minTurnover24h = Math.max(0, Number.isFinite(rawMinTurnover24h) ? rawMinTurnover24h : 1_000_000);
  const universeMode = String(url.searchParams.get("universe") || "bybit").toLowerCase();
  const maxUniverse = Math.min(1000, Math.max(1, Number(url.searchParams.get("maxUniverse")) || 1000));
  const jobOffset = Math.max(0, Number(url.searchParams.get("jobOffset")) || 0);
  const jobLimit = Math.min(12, Math.max(1, Number(url.searchParams.get("jobLimit")) || 8));
  if (!timeframes.length || !exchanges.length) return json({ error:"Unsupported radar settings" }, 400, { cacheControl:"no-store" });

  let scanUniverse = [];

  if (universeMode === "manual") {
    scanUniverse = RADAR_UNIVERSE.map((ticker) => ({
      ticker,
      slug: ticker.toLowerCase(),
      name: RADAR_META[ticker]?.name || ticker,
      coingeckoId: RADAR_META[ticker]?.coingeckoId || null,
      symbol: `${ticker}USDT`,
      exchange: "BYBIT",
      change24hPct: null,
      volume24h: null,
      turnover24h: null,
      marketCap: null,
    }));
  } else {
    scanUniverse = await fetchBybitSpotUsdtUniverse({
      minTurnover24h,
      maxUniverse,
    });
  }

  scanUniverse = scanUniverse.slice(0, maxUniverse);

  const allJobs = [];
  for (const asset of scanUniverse) {
    for (const timeframe of timeframes) {
      allJobs.push({ asset, ticker: asset.ticker, timeframe });
    }
  }

  const scanJobs = allJobs.slice(jobOffset, jobOffset + jobLimit);
  const nextJobOffset = jobOffset + scanJobs.length;
  const done = nextJobOffset >= allJobs.length;
  const candleTimeoutMs = timeframes.some((tf) => ["1m", "3m", "5m"].includes(tf)) ? 2800 : 3800;
  const scanConcurrency = timeframes.length > 1 ? 1 : 2;

  const rows = [];
  await mapLimit(scanJobs, scanConcurrency, async ({ asset, ticker, timeframe }) => {
    const fallbackMeta = RADAR_META[ticker] || {};
    const meta = {
      slug: asset?.slug || fallbackMeta.slug || ticker.toLowerCase(),
      ticker: asset?.ticker || fallbackMeta.ticker || ticker,
      name: fallbackMeta.name || asset?.name || ticker,
      coingeckoId: fallbackMeta.coingeckoId || asset?.coingeckoId || null,
    };

    if (isRadarBudgetExceeded(startedAt, maxRuntimeMs)) {
      attempts.push(radarAttempt({
        ticker,
        timeframe,
        status:"skipped_timeout",
        reason:"Radar scan stopped by runtime budget",
      }));
      return;
    }

    let routes = [];

    if (exchanges.length === 1 && exchanges[0] === "BYBIT" && asset?.symbol) {
      routes = [{
        exchange: "BYBIT",
        symbol: asset.symbol,
        source: "Bybit spot",
      }];
    } else {
      const marketSymbols = createMarketSymbols(ticker, { exchanges });
      routes = marketTechnicalRoutes(marketSymbols).filter((route) => exchanges.includes(route.exchange));
    }
    const routeLabels = routes.map((route) => `${route.exchange}:${route.symbol}`);
    if (!routes.length) {
      attempts.push(radarAttempt({ ticker, timeframe, status:"no_route", reason:"No market routes after exchange filter" }));
      return;
    }

    let candleResult = null;
    let candles = [];
    let range = null;
    try {
      candleResult = await fetchMarketCandlesWithFallback(routes, timeframe, {
        minCandles:50,
        timeoutMs:candleTimeoutMs,
        deadlineMs:startedAt + maxRuntimeMs,
      });
      candles = candleResult.candles || [];

      if (isRadarBudgetExceeded(startedAt, maxRuntimeMs)) {
        attempts.push(radarAttempt({
          ticker,
          timeframe,
          routes:routeLabels,
          status:"skipped_timeout",
          exchange:candleResult?.exchange || null,
          symbol:candleResult?.symbol || null,
          candlesCount:candles.length,
          reason:"Radar scan stopped after candle fetch",
        }));
        return;
      }

      if (!candleResult.route || !candles.length) {
        attempts.push(radarAttempt({ ticker, timeframe, routes:routeLabels, status:"no_candles", reason:"No candles from supported exchanges", errors:candleResult.errors || [] }));
        return;
      }

      const rangeData = rangeMode === "last_bullish" ? lastBullishRangeForCandles(candles) : activePreviewRangeForCandles(candles);
      const rawRange = rangeData.range;
      range = rangePayload(rawRange, rangeData.analysisCandles);
      if (!range) {
        attempts.push(radarAttempt({ ticker, timeframe, routes:routeLabels, status:"no_range", exchange:candleResult.exchange, symbol:candleResult.symbol, candlesCount:candles.length, reason:rangeMode === "last_bullish" ? "detectRangesWithPreview returned no bullish range" : "detectRangesWithPreview returned no previewRange", rangeSource:rangeData.source }));
        return;
      }

      if (!range.bullish) {
        attempts.push(radarAttempt({ ticker, timeframe, routes:routeLabels, status:"bearish_range", exchange:candleResult.exchange, symbol:candleResult.symbol, candlesCount:candles.length, rangeBullish:range.bullish, reason:"Active range is bearish", rangeSource:rangeData.source }));
        return;
      }

      const levels = buildRadarLevels(range, { entryFib, avgFibs });
      if (![levels.take.value, levels.entry.value].every((v) => Number.isFinite(v) && v > 0)) {
        attempts.push(radarAttempt({ ticker, timeframe, routes:routeLabels, status:"invalid_levels", exchange:candleResult.exchange, symbol:candleResult.symbol, candlesCount:candles.length, rangeBullish:range.bullish, reason:"Radar levels are invalid", rangeSource:rangeData.source }));
        return;
      }

      const last = candles[candles.length - 1];
      const price = Number(last.close);
      const distanceToEntryPct = ((price - levels.entry.value) / levels.entry.value) * 100;
      const absDistanceToEntryPct = Math.abs(distanceToEntryPct);
      const potentialToTakePct = ((levels.take.value - price) / price) * 100;
      const low = Math.min(range.aPrice, range.bPrice), high = Math.max(range.aPrice, range.bPrice);
      rows.push({
        id:`${ticker}-${timeframe}-${candleResult.exchange}`, slug:meta.slug, ticker:meta.ticker, name:meta.name,
        coingeckoId:meta.coingeckoId, branding:null, iconUrl:null,
        exchange:candleResult.exchange, source:candleResult.source, symbol:candleResult.symbol, timeframe,
        price,
        change24hPct: asset?.change24hPct ?? null,
        volume24h: asset?.volume24h ?? asset?.turnover24h ?? null,
        turnover24h: asset?.turnover24h ?? null,
        volume24hBase: asset?.volume24hBase ?? null,
        marketCap: null,
        range, rangeSource:rangeData.source, levels, chartLevels:planChartLevels(levels),
        metrics:{ distanceToEntryPct, absDistanceToEntryPct, potentialToTakePct, rangePct:range.heightPct, pricePosition:(price - low) / (high - low), status:radarStatus(price, levels, absDistanceToEntryPct) },
        candles,
      });
      attempts.push(radarAttempt({ ticker, timeframe, routes:routeLabels, status:"added", exchange:candleResult.exchange, symbol:candleResult.symbol, candlesCount:candles.length, rangeBullish:range.bullish, reason:"Bullish range added", rangeSource:rangeData.source }));
    } catch (error) {
      attempts.push(radarAttempt({ ticker, timeframe, routes:routeLabels, status:"error", reason:error instanceof Error ? error.message : String(error), exchange:candleResult?.exchange || null, symbol:candleResult?.symbol || null, candlesCount:candles.length, rangeBullish:range?.bullish ?? null }));
    }
  });
  rows.sort((a, b) => a.metrics.absDistanceToEntryPct - b.metrics.absDistanceToEntryPct || (b.volume24h || 0) - (a.volume24h || 0) || b.metrics.potentialToTakePct - a.metrics.potentialToTakePct);
  if (includeMarket && rows.length && !isRadarBudgetExceeded(startedAt, maxRuntimeMs)) {
    await enrichRadarRowsWithMarket(rows, Math.min(limit, 20));
  }
  const runtimeMs = Date.now() - startedAt;
  const summary = summarizeRadarAttempts(attempts);
  summary.market_enriched = rows.filter((row) => row.volume24h || row.marketCap || row.change24hPct !== null).length;
  summary.market_missing = rows.length - summary.market_enriched;
  summary.universe_after_liquidity_filter = scanUniverse.length;
  summary.min_turnover_24h = minTurnover24h;
  return json({
    settings:{ timeframes, entryFib, avgFibs, exchanges, limit, rangeMode, universeMode, maxUniverse, minTurnover24h },
    count:rows.length,
    message:rows.length ? `Найдено бычьих диапазонов: ${rows.length}` : "Бычьи диапазоны по выбранным настройкам не найдены",
    summary,
    progress:{
      jobOffset,
      jobLimit,
      checkedThisBatch:scanJobs.length,
      nextJobOffset,
      done,
      totalJobs:allJobs.length,
      totalUniverse:scanUniverse.length,
      minTurnover24h,
      requestedTimeframes:timeframes,
      universeMode,
    },
    partial:runtimeMs >= maxRuntimeMs || summary.skipped_timeout > 0,
    runtimeMs,
    updated_at:new Date().toISOString(),
    results:rows.slice(0, limit),
    debug:debug ? {
      scannedJobs:scanJobs.length,
      totalJobs:allJobs.length,
      totalUniverse:scanUniverse.length,
      requestedTimeframes:timeframes,
      requestedExchanges:exchanges,
      universeMode,
      minTurnover24h,
      attempts,
      added:rows.length,
      jobOffset,
      jobLimit,
      nextJobOffset,
      done,
    } : undefined,
  }, 200, { cacheControl:"no-store, no-cache, must-revalidate, max-age=0" });
}

async function handleReportShellApi(request, env, url) {
  const input = decodeURIComponent(url.pathname.replace("/api/report-shell/", "").replace(/\/$/, "")).trim().toLowerCase();
  if (!input) return json({ error:"Missing report slug or ticker" }, 400, { cacheControl:"no-store" });
  try {
    const persistentResolution = await getPersistentResolution(env, input);
    const project = isBadFallbackResolution(persistentResolution) || !persistentResolution ? await resolveProject(input) : persistentResolution;
    if (!project) return json({ error:"Unknown project", input }, 404, { cacheControl:"no-store" });
    return json(await buildReportShell(project), 200, { cacheControl:"public, max-age=30, stale-while-revalidate=300" });
  } catch (error) {
    return json({ error:"Report shell unavailable", recoverable:true, input, reason:error instanceof Error ? error.message : String(error) }, 502, { cacheControl:"no-store" });
  }
}

async function handleTradePlanCandles(url) {
  const input = decodeURIComponent(url.pathname.replace("/api/trade-plan-candles/", "").replace(/\/$/, "")).trim().toLowerCase();
  const timeframe = url.searchParams.get("timeframe") || "4h";
  if (!["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"].includes(timeframe)) return json({ error:"Unsupported timeframe" }, 400, { cacheControl:"no-store" });
  try {
    const project = await resolveProject(input);
    const preferredExchange = String(url.searchParams.get("exchange") || "").toUpperCase();
    let routes = marketTechnicalRoutes(project?.marketSymbols);
    if (preferredExchange) routes = [...routes.filter((route) => route.exchange === preferredExchange), ...routes.filter((route) => route.exchange !== preferredExchange)];
    if (!routes.length) return json({ error:"Market route unavailable" }, 404, { cacheControl:"no-store" });
    const candleResult = await fetchMarketCandlesWithFallback(routes, timeframe, { minCandles:50 });
    if (!candleResult.route || !candleResult.candles.length) {
      return json({ error:"Candles unavailable on supported exchanges", timeframe, routes, attempts:candleResult.errors || [] }, 404, { cacheControl:"no-store" });
    }
    const candles = candleResult.candles;
    const { analysisCandles, range:rawRange } = activeRangeForCandles(candles);
    const range = rawRange ? { aTime:analysisCandles[rawRange[0]]?.time, bTime:analysisCandles[rawRange[1]]?.time, aPrice:rawRange[2], bPrice:rawRange[3], bullish:rawRange[4] } : null;
    const firstCandle = candles[0] || null;
    const lastCandle = candles[candles.length - 1] || null;
    return json({ timeframe, source:candleResult.source, exchange:candleResult.exchange, symbol:candleResult.symbol, routes, candles, candle_debug:{ count:candles.length, first_time:firstCandle?.time || null, last_time:lastCandle?.time || null, first_close:firstCandle?.close || null, last_close:lastCandle?.close || null, ascending:candles.every((c, index) => index === 0 || c.time > candles[index - 1].time) }, analysisCandleCount:analysisCandles.length, range, updated_at:new Date().toISOString(), last_candle_time:lastCandle?.time || null }, 200, { cacheControl:"no-store, no-cache, must-revalidate, max-age=0" });
  } catch (error) {
    return json({ error:"Candles unavailable", reason:error instanceof Error ? error.message : String(error) }, 502, { cacheControl:"no-store" });
  }
}

const COINGECKO_MARKET_SNAPSHOT_TTL_MS = 5 * 60 * 1000;
const coinGeckoMarketSnapshots = new Map();

function attachBrandingDebug(report) {
  const branding = report?.meta?.branding || {};
  report.meta = report.meta || {};
  report.meta.icon_debug = {
    hasIconUrl:typeof branding.iconUrl === "string" && /^https:\/\//i.test(branding.iconUrl),
    iconUrl:branding.iconUrl || null,
    iconUrlsCount:Array.isArray(branding.iconUrls) ? branding.iconUrls.length : 0,
    iconSource:branding.iconSource || null,
    iconKey:branding.iconKey || null,
  };
}

export function isBadFallbackResolution(project) {
  return project?.resolution?.source === "fallback" && !project?.coingeckoId;
}

export function isPersistableResolution(project) {
  if (!project?.resolution) return false;
  if (project.resolution.mode === "registered") return true;
  return project.resolution.source === "discovery" && Boolean(project.coingeckoId);
}

async function handleHybridReportApi(request, env, url, ctx) {
  const input = decodeURIComponent(url.pathname.replace("/api/report/", "").replace(/\/$/, "")).trim().toLowerCase();
  if (!input) return json({ error: "Missing report slug or ticker" }, 400);

  const clientCacheVersion = url.searchParams.get("client_cache_version");
  const forceRefresh = url.searchParams.get("force_refresh") === "1";
  const cacheVersionMismatch = Boolean(clientCacheVersion && clientCacheVersion !== REPORT_CACHE_VERSION);

  if (forceRefresh || cacheVersionMismatch) {
    const snapshot = await runSingleFlight(input, () => buildAndCacheReport(request, env, url, input));

    if (snapshot.status >= 500 || snapshot.status === 425 || snapshot.status === 429 || snapshot.status === 408) {
      const fallback = getFallbackReport(input) || await getPersistentReport(env, input);

      if (fallback) {
        return responseFromSnapshot(fallback, forceRefresh ? "forced-refresh-fallback" : "version-refresh-fallback");
      }
    }

    return responseFromSnapshot(snapshot, "forced-refresh");
  }

  const cached = getCachedReport(input);
  if (cached?.cacheState === "fresh") return responseFromSnapshot(cached, "fresh");
  if (cached?.cacheState === "stale") {
    const refresh = runSingleFlight(input, () => buildAndCacheReport(request, env, url, input));
    if (ctx?.waitUntil) ctx.waitUntil(refresh);
    else refresh.catch(() => {});
    return responseFromSnapshot(cached, "stale");
  }

  const persistent = await getPersistentReport(env, input);
  if (persistent) {
    const refresh = runSingleFlight(input, () => buildAndCacheReport(request, env, url, input));
    if (ctx?.waitUntil) ctx.waitUntil(refresh);
    else refresh.catch(() => {});
    return responseFromSnapshot(persistent, "persistent-stale");
  }

  const snapshot = await runSingleFlight(input, () => buildAndCacheReport(request, env, url, input));
  if (snapshot.status >= 500) {
    const fallback = getFallbackReport(input) || await getPersistentReport(env, input);
    if (fallback) return responseFromSnapshot(fallback, "fallback");
  }
  return responseFromSnapshot(snapshot, "miss");
}

async function buildAndCacheReport(request, env, url, input) {
  const response = await buildHybridReportResponse(request, env, url, input);
  const snapshot = await responseSnapshot(response);
  setCachedReport(input, snapshot);
  await setPersistentReport(env, input, snapshot);
  return snapshot;
}

async function buildHybridReportResponse(request, env, url, input) {
  let project;
  try {
    const persistentResolution = await getPersistentResolution(env, input);
    project = isBadFallbackResolution(persistentResolution) || !persistentResolution ? await resolveProject(input) : persistentResolution;
    if (isPersistableResolution(project)) await setPersistentResolution(env, input, project);
  } catch (error) {
    return json({ error:"Project resolution failed", kind:"temporary_fetch_issue", recoverable:true, input, reason:error instanceof Error ? error.message : String(error) }, 502);
  }
  if (!project) return json({ error: "Unknown project slug or ticker", kind:"project_not_found", recoverable:false, input }, 404);
  if (project.resolution?.source === "fallback" && !project.coingeckoId) {
    return json({ error:"Project discovery temporarily unavailable", kind:"temporary_fetch_issue", recoverable:true, input }, 425, { cacheControl:"no-store" });
  }
  if (project.resolution?.mode === "runtime") return handleRuntimeReport(project);

  const slug = project.slug;
  const staticJson = await loadStaticReportJson(request, env, slug);
  if (staticJson.missing) return handleRuntimeReport(project, { curatedFallback:true });
  if (!staticJson.ok) return staticJson.response;
  const report = staticJson.data;
  report.meta = report.meta || {};
  report.meta.project_resolution = project.resolution;
  report.meta.branding = mergeBranding(report.meta.branding, project.branding);
  report.meta.market_symbols = project.marketSymbols || report.meta.market_symbols || null;
  applySectionSelection(report, project);

  try {
    const live = await fetchLiveMetrics(project);
    mergeLiveMetrics(report, live);
    report.meta.branding = mergeBranding(report.meta.branding, project.branding, live.branding);
    applyProfileAwareSemantics(report, project, { preserveCurated:Boolean(project.reportOptions?.preserveCuratedSemantics) });
    applySectionSelection(report, project);
    applyBlockRenderingRules(report, project, live);
    const marketAttempts = live.readinessSummary?.attempts?.cgMarket || 1;
    report.meta.source_state = live.debug?.cgMarket === "fulfilled"
      ? (marketAttempts > 1 ? "retry-live" : "live")
      : "manual";
    const readiness = publishReportReadiness(report, project, live.readinessSummary);
    if (!readiness.usable) return json({ error:"Critical report data unavailable", readiness }, 503, { cacheControl:"no-store" });

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
    attachBrandingDebug(report);
    return json(report, 200, { cacheControl: resolveReportCacheControl(report.meta.data_status) });
  } catch (error) {
    report.meta = report.meta || {};
    report.meta.branding = mergeBranding(report.meta.branding, project.branding);
    report.meta.updated_at = new Date().toISOString();
    report.meta.data_status = "hybrid-fallback";
    report.meta.source_state = "manual";
    report.meta.live_error = error instanceof Error ? error.message : String(error);
    report.meta.generated_at = new Date().toISOString();
    applyProfileAwareSemantics(report, project, { preserveCurated:Boolean(project.reportOptions?.preserveCuratedSemantics) });
    applySectionSelection(report, project);
    applyBlockRenderingRules(report, project, null);
    const readiness = publishReportReadiness(report, project);
    if (!readiness.usable) return json({ error:"Critical report data unavailable", readiness }, 503, { cacheControl:"no-store" });
    attachBrandingDebug(report);
    return json(report, 200, { cacheControl: resolveReportCacheControl(report.meta.data_status) });
  }
}


async function handleRuntimeReport(project, { curatedFallback = false } = {}) {
  try {
    const report = await buildReport(project);
    report.meta = report.meta || {};
    report.meta.project_resolution = project.resolution;
    report.meta.branding = mergeBranding(report.meta.branding, project.branding);
    report.meta.market_symbols = project.marketSymbols || report.meta.market_symbols || null;
    report.meta.data_status = curatedFallback ? "curated-runtime-partial" : "runtime-partial";
    report.meta.source_state = report.meta.source_state || "live";
    if (curatedFallback) {
      report.meta.static_report = {
        status:"missing",
        fallback:"runtime-build",
      };
    }
    report.meta.generated_at = new Date().toISOString();
    const readiness = publishReportReadiness(report, project, report.meta.source_readiness);
    if (!readiness.usable) return json({ error:"Critical runtime report data unavailable", readiness }, 503, { cacheControl:"no-store" });
    attachBrandingDebug(report);
    return json(report, 200, { cacheControl:resolveReportCacheControl(report.meta.data_status) });
  } catch (error) {
    return json({ error:"Runtime report build failed", ticker:project.ticker, reason:error instanceof Error ? error.message : String(error) }, 502);
  }
}

async function loadStaticReportJson(request, env, slug) {
  const jsonUrl = new URL(`/data/reports/${slug}.json`, request.url);
  const assetRequest = new Request(jsonUrl.toString(), request);
  let response;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await env.ASSETS.fetch(assetRequest.clone());
    if (response.ok || response.status === 404 || response.status < 500) break;
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, [150, 400][attempt]));
  }

  if (response.status === 404) {
    return { ok:false, missing:true };
  }
  if (!response.ok) {
    return { ok: false, response: json({ error:"Failed to load report JSON", kind:"temporary_fetch_issue", recoverable:true, slug, status:response.status }, 503, { cacheControl:"no-store" }) };
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
    { name:"technicalBias", load:()=>getTechnicalBias(marketTechnicalRoutes(project.marketSymbols)) },
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
    branding: brandingFromCoinGeckoAsset(effectiveCoinGeckoMarket),
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
    image: fallback.data?.image?.large || fallback.data?.image?.small || fallback.data?.image?.thumb || null,
  };
  if (!hasAnyCoinGeckoMarketValue(normalized)) return null;
  return normalized;
}
const COINGECKO_MARKET_FIELDS = ["current_price", "market_cap", "fully_diluted_valuation", "total_volume", "circulating_supply", "total_supply", "max_supply"];
const COINGECKO_TOKENOMICS_FIELDS = ["market_cap", "fully_diluted_valuation", "circulating_supply", "total_supply"];

export function mergeCoinGeckoMarketData(primary, fallback) {
  if (!hasAnyCoinGeckoMarketValue(primary) && !hasAnyCoinGeckoMarketValue(fallback)) return null;
  const merged = Object.fromEntries(COINGECKO_MARKET_FIELDS.map((field) => {
    const primaryValue = toNumber(primary?.[field]);
    const fallbackValue = toNumber(fallback?.[field]);
    return [field, isValidNumber(primaryValue) ? primaryValue : fallbackValue];
  }));
  const image = isHttpsUrl(primary?.image) ? primary.image : (isHttpsUrl(fallback?.image) ? fallback.image : null);
  return image ? { ...merged, image } : merged;
}

function hasCompleteCoinGeckoTokenomics(row) {
  return COINGECKO_TOKENOMICS_FIELDS.every((field) => isValidNumber(toNumber(row?.[field])));
}

function hasAnyCoinGeckoMarketValue(row) {
  return COINGECKO_MARKET_FIELDS.some((key) => isValidNumber(toNumber(row?.[key])));
}
function hasCoreCoinGeckoMarketValue(row) {
  const price = toNumber(row?.current_price); const marketCap = toNumber(row?.market_cap);
  const fdv = toNumber(row?.fully_diluted_valuation); const volume = toNumber(row?.total_volume);
  return isValidNumber(price) && price > 0 && ((isValidNumber(marketCap) && marketCap > 0) || (isValidNumber(fdv) && fdv > 0)) && isValidNumber(volume) && volume > 0;
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
function jsonResponse(data, { status = 200, cacheControl = "no-store" } = {}) { return json(data, status, { cacheControl }); }
