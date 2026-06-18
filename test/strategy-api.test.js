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
