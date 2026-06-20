import test from "node:test";
import assert from "node:assert/strict";
import { fetchBybitCandlesCoveringTime } from "../src/adapters/bybit.js";

function row(time, price = 100) {
  return [String(time), String(price), String(price + 1), String(price - 1), String(price)];
}

function response(list) {
  return { ok:true, status:200, async json() { return { result:{ list } }; } };
}

async function withFetch(handler, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = handler;
  try { return await fn(); } finally { globalThis.fetch = original; }
}

test("Bybit pagination covers B on first page", async () => {
  const calls = [];
  const result = await withFetch((url) => {
    calls.push(String(url));
    return response([row(1000), row(1060), row(1120)]);
  }, () => fetchBybitCandlesCoveringTime("BTCUSDT", "15m", 1000, { maxPages:5 }));

  assert.equal(result.pagesFetched, 1);
  assert.equal(result.covered, true);
  assert.equal(calls.length, 1);
});

test("Bybit pagination covers B on second page, dedupes, and sorts", async () => {
  const pages = [
    [row(2000), row(2060), row(2120)],
    [row(1880), row(1940), row(2000)],
  ];
  const result = await withFetch(() => response(pages.shift()), () =>
    fetchBybitCandlesCoveringTime("BTCUSDT", "15m", 1900, { maxPages:5 })
  );

  assert.equal(result.pagesFetched, 2);
  assert.equal(result.covered, true);
  assert.deepEqual(result.candles.map((c) => c.time), [1880, 1940, 2000, 2060, 2120]);
});

test("Bybit pagination stops after covering B", async () => {
  let calls = 0;
  const pages = [[row(2000), row(2060)], [row(1880), row(1940)]];
  const result = await withFetch(() => {
    calls += 1;
    return response(pages.shift());
  }, () => fetchBybitCandlesCoveringTime("BTCUSDT", "15m", 1900, { maxPages:5 }));

  assert.equal(result.covered, true);
  assert.equal(calls, 2);
});

test("Bybit pagination stops at max depth when B is older", async () => {
  let earliest = 10_000;
  const result = await withFetch(() => {
    const page = [row(earliest), row(earliest + 60)];
    earliest -= 120;
    return response(page);
  }, () => fetchBybitCandlesCoveringTime("BTCUSDT", "15m", 1, { maxPages:5 }));

  assert.equal(result.pagesFetched, 5);
  assert.equal(result.covered, false);
});

test("Bybit pagination checks deadline before fetching another page", async () => {
  let calls = 0;
  const originalNow = Date.now;
  Date.now = () => calls === 0 ? 1000 : 2000;
  try {
    const result = await withFetch(() => {
      calls += 1;
      return response([row(2000), row(2060)]);
    }, () => fetchBybitCandlesCoveringTime("BTCUSDT", "15m", 1000, { maxPages:5, deadlineMs:1500 }));

    assert.equal(calls, 1);
    assert.equal(result.covered, false);
  } finally {
    Date.now = originalNow;
  }
});
