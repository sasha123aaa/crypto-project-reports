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
    if (this.sql.includes("strategy_monitor_state")) {
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
  assert.match(source, /if\(state==="filled"\)return "Касание было"/);
  assert.match(source, /strategyLevelStateText\(state,source\)/);
});


test("processStrategyJob creates a trade when price touched entry after range even if current price is above entry", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("src/index.js", "utf8"));
  assert.match(source, /if \(!existing && plan\.status === "waiting_entry"\) return/);
  assert.match(source, /activatedLevels:plan\.activatedLevels/);
  assert.match(source, /averagePrice:plan\.averagePrice/);
  assert.match(source, /takePrice:plan\.takePrice/);
  assert.match(source, /usedCapitalPct:plan\.usedCapitalPct/);
  assert.match(source, /updated\.status === "take_hit" && !updated\.closedAt/);
});
