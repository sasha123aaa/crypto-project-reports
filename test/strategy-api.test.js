import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

async function readJson(response) {
  return JSON.parse(await response.text());
}

test("/api/strategy/run-monitor without STRATEGY_ADMIN_KEY returns 403", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/run-monitor"), {});
  const payload = await readJson(response);

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /STRATEGY_ADMIN_KEY/);
});

test("/api/strategy/run-monitor with invalid key returns 403", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/strategy/run-monitor?key=wrong"),
    { STRATEGY_ADMIN_KEY:"secret" }
  );
  const payload = await readJson(response);

  assert.equal(response.status, 403);
  assert.equal(payload.ok, false);
  assert.match(payload.message, /Invalid strategy admin key/);
});

test("/api/strategy/run-monitor with valid key and without D1 returns dbAvailable false", async () => {
  const response = await worker.fetch(
    new Request("https://example.com/api/strategy/run-monitor?key=secret"),
    { STRATEGY_ADMIN_KEY:"secret" }
  );
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, false);
  assert.equal(payload.dbAvailable, false);
  assert.match(payload.message, /D1 database is not configured/);
});

test("/api/strategy/status without D1 returns dbAvailable false", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/status"), {});
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.dbAvailable, false);
  assert.equal(payload.monitorActive, false);
  assert.equal(payload.monitorState.batchSize, 20);
  assert.deepEqual(payload.totals, {
    totalTrades:0,
    activeTrades:0,
    takeHits:0,
    drawdownTrades:0,
  });
});

test("/api/strategy/active without D1 returns an empty trades list", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/active"), {});
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.dbAvailable, false);
  assert.deepEqual(payload.trades, []);
});

test("/api/strategy/trades?limit=50 without symbol works without D1", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/trades?limit=50"), {});
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.dbAvailable, false);
  assert.deepEqual(payload.trades, []);
});

test("/api/strategy/stats without symbol works without D1", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/stats"), {});
  const payload = await readJson(response);

  assert.equal(response.status, 200);
  assert.equal(payload.dbAvailable, false);
  assert.deepEqual(payload.stats, []);
  assert.equal(payload.aggregate.totalTrades, 0);
});


class FakeDb {
  constructor() { this.state = {}; }
  prepare(sql) { return new FakeStmt(this, sql); }
}
class FakeStmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async first() {
    if (this.sql.includes("strategy_monitor_state")) {
      const key = this.sql.includes("key='main'") ? "main" : this.args[0];
      return this.db.state[key] ? { value_json:JSON.stringify(this.db.state[key]) } : null;
    }
    if (this.sql.includes("COUNT(*) AS count")) return { count:0 };
    if (this.sql.includes("virtual_trades")) return null;
    return null;
  }
  async all() { return { results:[] }; }
  async run() {
    if (this.sql.includes("INSERT OR REPLACE INTO strategy_monitor_state")) {
      const key = this.sql.includes("'main'") ? "main" : this.args[0];
      const value = this.sql.includes("'main'") ? this.args[0] : this.args[1];
      this.db.state[key] = JSON.parse(value);
    }
    return { success:true };
  }
}

async function withMockFetch(mock, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mock;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

async function resetBybitCaches() {
  const mod = await import(`../src/adapters/bybit.js?reset=${Date.now()}-${Math.random()}`);
  mod.__resetBybitAdapterCaches();
}

test("runStrategyMonitorBatch builds jobs for every entry mode", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?jobs=${Date.now()}-${Math.random()}`);
  __strategyTestInternals.__resetBybitAdapterCaches();
  const db = new FakeDb();
  await withMockFetch(async (url) => {
    const href = String(url);
    if (href.includes("/v5/market/tickers")) {
      return Response.json({ result:{ list:[
        { symbol:"BTCUSDT", lastPrice:"100", turnover24h:"2000000" },
        { symbol:"ETHUSDT", lastPrice:"50", turnover24h:"2000000" },
      ] } });
    }
    if (href.includes("/v5/market/instruments-info")) {
      return Response.json({ result:{ list:[
        { baseCoin:"BTC", quoteCoin:"USDT", symbol:"BTCUSDT", status:"Trading" },
        { baseCoin:"ETH", quoteCoin:"USDT", symbol:"ETHUSDT", status:"Trading" },
      ], nextPageCursor:"" } });
    }
    return new Response("unavailable", { status:500 });
  }, async () => {
    const state = await __strategyTestInternals.runStrategyMonitorBatch({ DB:db });
    assert.equal(state.universeSize, 2);
    assert.equal(state.totalJobs, 24);
    assert.deepEqual(state.entryModes, [0.31, 0.5, 0.75]);
    assert.equal(state.lastError, null);
  });
});

test("runStrategyMonitorBatch falls back when Bybit tickers returns 403", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?fallback=${Date.now()}-${Math.random()}`);
  __strategyTestInternals.__resetBybitAdapterCaches();
  const db = new FakeDb();
  await withMockFetch(async (url) => {
    const href = String(url);
    if (href.includes("/v5/market/tickers")) return new Response("forbidden", { status:403 });
    if (href.includes("/v5/market/instruments-info")) throw new Error("Bybit tickers HTTP 403");
    return new Response("unavailable", { status:500 });
  }, async () => {
    const state = await __strategyTestInternals.runStrategyMonitorBatch({ DB:db });
    assert.equal(state.universeSource, "fallback");
    assert.match(state.universeWarning, /Bybit tickers HTTP 403/);
    assert.equal(state.lastError, null);
    assert.equal(state.totalJobs, __strategyTestInternals.fallbackStrategyUniverse().length * 4 * 3);
  });
});

test("/api/strategy/status returns universe source and warning", async () => {
  const db = new FakeDb();
  db.state.main = { universeSource:"fallback", universeWarning:"Bybit tickers HTTP 403", lastError:null };
  const response = await worker.fetch(new Request("https://example.com/api/strategy/status"), { DB:db });
  const payload = await readJson(response);
  assert.equal(payload.universeSource, "fallback");
  assert.equal(payload.universeWarning, "Bybit tickers HTTP 403");
  assert.equal(payload.monitorState.lastError, null);
});

test("trade-plan preview levels do not render active-trade filled text", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("public/assets/trade-plan.js", "utf8"));
  assert.match(source, /function isStrategyActiveTrade/);
  assert.match(source, /if\(state==="filled"\)return "Исполнено"/);
  assert.match(source, /strategyLevelStateText\(state,source\)/);
});


test("processStrategyJob creates a trade when price touched entry after range even if current price is above entry", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("src/index.js", "utf8"));
  assert.match(source, /evaluateStrategyPath\(\{ range:built\.range/);
  assert.match(source, /upsertStrategyTradeFromPlan/);
  assert.match(source, /Number\(plan\.activatedLevels \|\| 0\) <= 0/);
  assert.match(source, /status === "take_hit"/);
});

class MemoryStrategyDb {
  constructor() {
    this.strategyStatsColumns = new Set(["key","symbol","timeframe","entry_mode","exchange","total_trades","take_hits","active_trades","drawdown_trades","avg_result_pct","avg_drawdown_pct","avg_time_to_take_minutes","updated_at"]);
    this.trades = [];
    this.stats = [];
    this.events = [];
    this.state = {};
  }
  prepare(sql) { return new MemoryStrategyStmt(this, sql); }
}
class MemoryStrategyStmt {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  async all() {
    if (this.sql.includes("PRAGMA table_info(strategy_stats)")) return { results:[...this.db.strategyStatsColumns].map((name) => ({ name })) };
    if (this.sql.includes("SELECT DISTINCT") && this.sql.includes("FROM virtual_trades")) {
      const seen = new Set();
      const results = [];
      for (const t of this.db.trades) {
        if (!t.base_symbol || !t.timeframe || t.entry_mode == null || !t.exchange) continue;
        const key = `${t.base_symbol}:${t.timeframe}:${t.entry_mode}:${t.exchange}`;
        if (seen.has(key)) continue;
        seen.add(key);
        results.push({ symbol:t.base_symbol, timeframe:t.timeframe, entryMode:t.entry_mode, exchange:t.exchange });
      }
      return { results };
    }
    if (this.sql.includes("FROM virtual_trades") && this.sql.includes("WHERE status IN")) {
      const statuses = [...this.sql.matchAll(/'([^']+)'/g)].map((match) => match[1]);
      return { results:this.db.trades.filter((t) => statuses.includes(t.status)) };
    }
    if (this.sql.includes("FROM virtual_trades") && this.sql.includes("ORDER BY updated_at DESC LIMIT 1000")) {
      return { results:this.db.trades.slice(-1000).reverse() };
    }
    if (this.sql.includes("json_extract(range_json")) {
      throw new Error("json_extract unavailable in MemoryStrategyDb");
    }
    if (this.sql.includes("FROM virtual_trades")) {
      const [symbol, timeframe, entryMode, exchange] = this.args;
      return { results:this.db.trades.filter((t) => t.base_symbol === symbol && (!this.sql.includes("AND timeframe=?") || t.timeframe === timeframe) && (!this.sql.includes("AND entry_mode=?") || Number(t.entry_mode) === Number(entryMode)) && (!this.sql.includes("AND exchange=?") || t.exchange === exchange)) };
    }
    if (this.sql.includes("FROM strategy_stats")) return { results:this.db.stats.filter((s) => !this.args[0] || s.symbol === this.args[0]) };
    return { results:[] };
  }
  async first() { return null; }
  async run() {
    if (this.sql.includes("ALTER TABLE strategy_stats ADD COLUMN")) this.db.strategyStatsColumns.add(this.sql.match(/ADD COLUMN (\w+)/)?.[1]);
    if (this.sql.includes("INSERT OR REPLACE INTO virtual_trades")) {
      const [id,symbol,base_symbol,exchange,timeframe,direction,entry_mode,range_json,levels_json,status,opened_at,updated_at,closed_at,entry_price,average_price,take_price,current_price,activated_levels,used_capital_pct,max_drawdown_pct,current_pnl_pct,result_pct,result_on_full_capital_pct] = this.args;
      this.db.trades = this.db.trades.filter((t) => t.id !== id);
      this.db.trades.push({ id,symbol,base_symbol,exchange,timeframe,direction,entry_mode,range_json,levels_json,status,opened_at,updated_at,closed_at,entry_price,average_price,take_price,current_price,activated_levels,used_capital_pct,max_drawdown_pct,current_pnl_pct,result_pct,result_on_full_capital_pct });
    }
    if (this.sql.includes("INSERT OR IGNORE INTO virtual_trade_events")) this.db.events.push(this.args);
    if (this.sql.includes("UPDATE virtual_trades SET status=?")) {
      const [status, updated_at, id] = this.args;
      const trade = this.db.trades.find((t) => t.id === id);
      if (trade) {
        trade.status = status;
        trade.updated_at = updated_at;
      }
    }
    if (this.sql.includes("INSERT OR REPLACE INTO strategy_stats")) {
      const [key,symbol,timeframe,entry_mode,exchange,total_trades,take_hits,active_trades,drawdown_trades,avg_result_pct,avg_drawdown_pct,avg_time_to_take_minutes,max_activated_levels,avg_used_capital_pct,best_result_pct,worst_drawdown_pct,closed_full_capital_result_pct,active_unrealized_full_capital_pct,updated_at] = this.args;
      this.db.stats = this.db.stats.filter((s) => s.key !== key);
      this.db.stats.push({ key,symbol,timeframe,entry_mode,exchange,total_trades,take_hits,active_trades,drawdown_trades,avg_result_pct,avg_drawdown_pct,avg_time_to_take_minutes,max_activated_levels,avg_used_capital_pct,best_result_pct,worst_drawdown_pct,closed_full_capital_result_pct,active_unrealized_full_capital_pct,updated_at });
    }
    return { success:true };
  }
}

test("ensureStrategySchema adds missing strategy_stats columns", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?schema=${Date.now()}-${Math.random()}`);
  const db = new MemoryStrategyDb();
  const result = await __strategyTestInternals.ensureStrategySchema(db);
  assert.equal(result.repaired, true);
  assert.ok(result.added.includes("strategy_stats.max_activated_levels"));
  assert.ok(db.strategyStatsColumns.has("active_unrealized_full_capital_pct"));
});

test("/api/strategy/repair-schema requires admin key", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/repair-schema?key=wrong"), { STRATEGY_ADMIN_KEY:"secret", DB:new MemoryStrategyDb() });
  assert.equal(response.status, 403);
});

test("/api/strategy/rebuild-stats rebuilds stats from virtual_trades", async () => {
  const db = new MemoryStrategyDb();
  db.trades.push({ id:"1", symbol:"XLMUSDT", base_symbol:"XLM", exchange:"BYBIT", timeframe:"15m", entry_mode:0.5, status:"take_hit", activated_levels:2, used_capital_pct:50, max_drawdown_pct:-2, result_pct:3, result_on_full_capital_pct:1.5 });
  const response = await worker.fetch(new Request("https://example.com/api/strategy/rebuild-stats?key=secret"), { STRATEGY_ADMIN_KEY:"secret", DB:db });
  const payload = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.rebuilt, 1);
  assert.equal(db.stats[0].closed_full_capital_result_pct, 1.5);
});

test("/api/strategy/radar-stats returns activeTrade when strategy_stats is empty", async () => {
  const db = new MemoryStrategyDb();
  db.trades.push({ id:"a", symbol:"ASTERUSDT", base_symbol:"ASTER", exchange:"BYBIT", timeframe:"4h", entry_mode:0.5, status:"active", range_json:"null", levels_json:"[]", activated_levels:1, used_capital_pct:25, max_drawdown_pct:-2, current_pnl_pct:1.2 });
  const response = await worker.fetch(new Request("https://example.com/api/strategy/radar-stats?symbols=ASTER&timeframe=4h"), { DB:db });
  const payload = await readJson(response);
  assert.equal(payload.stats.ASTER["4h"].activeTrade.status, "active");
  assert.equal(payload.stats.ASTER["4h"].totalTrades, 1);
  assert.equal(payload.stats.ASTER["4h"].estimatedFullCapitalResultPct, 0.3);
});

test("/api/strategy/radar-stats estimated result sums closed and active result", async () => {
  const db = new MemoryStrategyDb();
  db.trades.push({ id:"closed", symbol:"BTCUSDT", base_symbol:"BTC", exchange:"BYBIT", timeframe:"4h", entry_mode:0.5, status:"take_hit", range_json:"null", levels_json:"[]", activated_levels:1, used_capital_pct:25, max_drawdown_pct:-1, result_pct:4, result_on_full_capital_pct:1 });
  db.trades.push({ id:"active", symbol:"BTCUSDT", base_symbol:"BTC", exchange:"BYBIT", timeframe:"4h", entry_mode:0.5, status:"active", range_json:"null", levels_json:"[]", activated_levels:1, used_capital_pct:50, max_drawdown_pct:-1, current_pnl_pct:2 });
  const response = await worker.fetch(new Request("https://example.com/api/strategy/radar-stats?symbols=BTC&timeframe=4h"), { DB:db });
  const payload = await readJson(response);
  assert.equal(payload.stats.BTC["4h"].closedFullCapitalResultPct, 1);
  assert.equal(payload.stats.BTC["4h"].activeUnrealizedFullCapitalPct, 1);
  assert.equal(payload.stats.BTC["4h"].estimatedFullCapitalResultPct, 2);
});

test("trade status ignores historical drawdown when current PnL is positive", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?status=${Date.now()}-${Math.random()}`);
  assert.equal(__strategyTestInternals.deriveTradeStatus({ activatedLevels:1, currentPnlPct:2, maxDrawdownPct:-5 }), "active");
  assert.equal(__strategyTestInternals.deriveTradeStatus({ activatedLevels:2, currentPnlPct:2, maxDrawdownPct:-5 }), "averaging");
});

test("normalizeTradeStatus fixes stale drawdown statuses", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?normalize=${Date.now()}-${Math.random()}`);
  assert.equal(__strategyTestInternals.normalizeTradeStatus({ status:"drawdown", activatedLevels:1, currentPnlPct:2 }).status, "active");
  assert.equal(__strategyTestInternals.normalizeTradeStatus({ status:"drawdown", activatedLevels:2, currentPnlPct:2 }).status, "averaging");
  assert.equal(__strategyTestInternals.normalizeTradeStatus({ status:"drawdown", activatedLevels:1, currentPnlPct:-1 }).status, "drawdown");
});

test("/api/strategy/repair-trades requires admin key", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/repair-trades?key=wrong"), { STRATEGY_ADMIN_KEY:"secret", DB:new MemoryStrategyDb() });
  assert.equal(response.status, 403);
});

test("/api/strategy/repair-trades updates wrong statuses", async () => {
  const db = new MemoryStrategyDb();
  db.trades.push({ id:"bad-active", symbol:"XLMUSDT", base_symbol:"XLM", exchange:"BYBIT", timeframe:"15m", entry_mode:0.5, status:"drawdown", range_json:"null", levels_json:"[]", activated_levels:1, used_capital_pct:20, max_drawdown_pct:-2, current_pnl_pct:1.1 });
  db.trades.push({ id:"bad-avg", symbol:"XLMUSDT", base_symbol:"XLM", exchange:"BYBIT", timeframe:"15m", entry_mode:0.5, status:"drawdown", range_json:"null", levels_json:"[]", activated_levels:2, used_capital_pct:30, max_drawdown_pct:-3, current_pnl_pct:0.5 });
  const response = await worker.fetch(new Request("https://example.com/api/strategy/repair-trades?key=secret"), { STRATEGY_ADMIN_KEY:"secret", DB:db });
  const payload = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.checked, 2);
  assert.equal(payload.updated, 2);
  assert.equal(db.trades.find((t) => t.id === "bad-active").status, "active");
  assert.equal(db.trades.find((t) => t.id === "bad-avg").status, "averaging");
});

test("/api/strategy/duplicates requires admin key", async () => {
  const response = await worker.fetch(new Request("https://example.com/api/strategy/duplicates?key=wrong"), { STRATEGY_ADMIN_KEY:"secret", DB:new MemoryStrategyDb() });
  assert.equal(response.status, 403);
});

test("/api/strategy/radar-stats returns NEAR-like active trade when strategy_stats is empty", async () => {
  const db = new MemoryStrategyDb();
  db.trades.push({ id:"near-active", symbol:"NEARUSDT", base_symbol:"NEAR", exchange:"BYBIT", timeframe:"15m", entry_mode:0.5, status:"averaging", range_json:"null", levels_json:"[]", activated_levels:2, used_capital_pct:40, max_drawdown_pct:-1.7, current_pnl_pct:-0.5 });
  const response = await worker.fetch(new Request("https://example.com/api/strategy/radar-stats?symbols=NEAR&timeframe=15m"), { DB:db });
  const payload = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.stats.NEAR["15m"].totalTrades, 1);
  assert.equal(payload.stats.NEAR["15m"].takeHits, 0);
  assert.equal(payload.stats.NEAR["15m"].activeTrade.symbol, "NEARUSDT");
  assert.equal(payload.stats.NEAR["15m"].maxActivatedLevels, 2);
});

test("/api/strategy/debug-symbol summarizes trades, stats and radar stats", async () => {
  const db = new MemoryStrategyDb();
  db.trades.push({ id:"near-active", symbol:"NEARUSDT", base_symbol:"NEAR", exchange:"BYBIT", timeframe:"15m", entry_mode:0.5, status:"active", range_json:"null", levels_json:"[]", activated_levels:1, used_capital_pct:20, max_drawdown_pct:-1, current_pnl_pct:0.2 });
  const response = await worker.fetch(new Request("https://example.com/api/strategy/debug-symbol?symbol=NEAR&timeframe=15m"), { DB:db });
  const payload = await readJson(response);
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.symbol, "NEAR");
  assert.equal(payload.tradesCount, 1);
  assert.equal(payload.activeTrades[0].status, "active");
  assert.equal(payload.radarStats.NEAR["15m"].totalTrades, 1);
});

test("bull radar source deep-merges strategy stats and loads stats during scan", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("public/assets/bull-radar.js", "utf8"));
  assert.match(source, /function mergeStrategyRadarStats/);
  assert.match(source, /strategyRadarStats\[key\]\[tf\]=value/);
  assert.doesNotMatch(source, /strategyRadarStats=\{\.\.\.strategyRadarStats,\.\.\.payload\.stats\}/);
  assert.match(source, /await loadStrategyRadarStatsForRows\(rawRows\);\n\s*renderAll\(\);/);
});

test("radar and strategy UI render Russian strategy statuses", async () => {
  const fs = await import("node:fs/promises");
  const radar = await fs.readFile("public/assets/bull-radar.js", "utf8");
  const dashboard = await fs.readFile("public/assets/strategy-dashboard.js", "utf8");
  const tradePlan = await fs.readFile("public/assets/trade-plan.js", "utf8");
  for (const source of [radar, dashboard, tradePlan]) {
    assert.match(source, /function strategyStatusRu/);
    assert.match(source, /В просадке/);
    assert.match(source, /Усреднение/);
    assert.match(source, /Ждет вход/);
  }
});

test("trade-plan levelStates take precedence over activatedLevels", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("public/assets/trade-plan.js", "utf8"));
  assert.match(source, /source\?\.levelStates\?\.\[index\]\?\.state/);
  assert.match(source, /if\(stateFromSource==="executed"\|\|stateFromSource==="filled"\)return "filled"/);
  assert.match(source, /return "Исполнено"/);
});

test("chartTradePayload preserves ratio capitalPct and qtyMultiplier", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?chartPayload=${Date.now()}-${Math.random()}`);
  const payload = __strategyTestInternals.chartTradePayload({
    id:"t1", status:"active", entryMode:0.5, activatedLevels:1,
    levels:[{ label:"Entry", price:90, ratio:0.5, capitalPct:8, qtyMultiplier:1.2 }],
  });
  assert.equal(payload.levels[0].ratio, 0.5);
  assert.equal(payload.levels[0].capitalPct, 8);
  assert.equal(payload.levels[0].qtyMultiplier, 1.2);
  assert.equal(payload.levelStates[0].ratio, 0.5);
  assert.equal(payload.levelStates[0].capitalPct, 8);
  assert.equal(payload.levelStates[0].qtyMultiplier, 1.2);
  assert.equal(payload.levels[0].state, "executed");
});

test("chartTradePayload restores incomplete legacy levels with calculateLevels", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?restoreLevels=${Date.now()}-${Math.random()}`);
  const payload = __strategyTestInternals.chartTradePayload({
    id:"legacy", status:"active", entryMode:0.5, activatedLevels:1,
    range:{ bullish:true, aPrice:100, bPrice:200 },
    levels:[{ label:"Вход", price:150 }],
  });
  assert.ok(payload.levels.length >= 10);
  assert.ok(payload.levels.every((level) => level.ratio != null));
  assert.ok(payload.levels.every((level) => level.capitalPct != null));
  assert.ok(payload.levels.every((level) => level.qtyMultiplier != null));
});

test("strategy backfill implementation uses Cloudflare-safe limits and state", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("src/index.js", "utf8"));
  assert.match(source, /ctx\.waitUntil\(runScheduledStrategyTasks\(env\)\)/);
  assert.match(source, /runStrategyBackfillBatch\(env, \{ limit:1, scheduled:true \}\)/);
  assert.match(source, /const requestedLimit = params\.get\("limit"\)/);
  assert.match(source, /clampLimit\(requestedLimit, 1, 3\)/);
  assert.match(source, /filterSignature = JSON\.stringify/);
  assert.match(source, /params\.get\("reset"\) === "1"/);
  assert.match(source, /processStrategyBackfillJob\(db, job, \{ deadlineMs \}\)/);
  assert.match(source, /timeoutMs:3500/);
  assert.match(source, /totals\.lastJobError = result\.error/);
});

test("runStrategyBackfillBatch defaults to one job and clamps limit to three", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?backfillLimit=${Date.now()}-${Math.random()}`);
  const db = new FakeDb();
  await withMockFetch(async () => new Response("unavailable", { status:500 }), async () => {
    const one = await __strategyTestInternals.runStrategyBackfillBatch(db, { symbol:"BTC", timeframe:"1h", entryMode:"0.5", maxRuntimeMs:"18000" });
    assert.equal(one.backfillState.batchSize, 1);
    assert.equal(one.backfillState.filterSignature, JSON.stringify({ symbol:"BTC", timeframes:["1h"], entryModes:[0.5] }));
    const three = await __strategyTestInternals.runStrategyBackfillBatch(db, { symbol:"BTC", timeframe:"1h", entryMode:"0.5", limit:"99", maxRuntimeMs:"18000" });
    assert.equal(three.backfillState.batchSize, 3);
  });
});

test("runStrategyBackfillBatch keeps filtered offset until reset", async () => {
  const { __strategyTestInternals } = await import(`../src/index.js?backfillOffset=${Date.now()}-${Math.random()}`);
  const db = new FakeDb();
  await withMockFetch(async () => new Response("unavailable", { status:500 }), async () => {
    const first = await __strategyTestInternals.runStrategyBackfillBatch(db, { symbol:"ETH", timeframe:"1h", limit:"1" });
    assert.equal(first.offset, 1);
    const second = await __strategyTestInternals.runStrategyBackfillBatch(db, { symbol:"ETH", timeframe:"1h", limit:"1" });
    assert.equal(second.offset, 2);
    const reset = await __strategyTestInternals.runStrategyBackfillBatch(db, { symbol:"ETH", timeframe:"1h", limit:"1", reset:"1" });
    assert.equal(reset.offset, 1);
  });
});
