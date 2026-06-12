import test from "node:test";
import assert from "node:assert/strict";
import { fetchBitcoinValuationHistory } from "../src/adapters/coinmetrics.js";

test("Coin Metrics BTC history derives realized price and NUPL from aligned public metrics", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(String(url), /assets=btc/);
    assert.match(String(url), /CapMVRVCur/);
    return new Response(JSON.stringify({ data:[
      { time:"2026-06-10T00:00:00Z", CapMVRVCur:"2", CapRealUSD:"1000", IssContPctAnn:"0.8", PriceUSD:"100", SplyCur:"10" },
      { time:"2026-06-11T00:00:00Z", CapMVRVCur:"2.5", CapRealUSD:"1200", IssContPctAnn:"0.7", PriceUSD:"125", SplyCur:"10" },
      { time:"2026-06-12T00:00:00Z", CapMVRVCur:null, CapRealUSD:null, IssContPctAnn:null, PriceUSD:null, SplyCur:null },
    ] }), { status:200 });
  };
  try {
    const result = await fetchBitcoinValuationHistory({ days:30 });
    assert.equal(result.current.mvrv, 2.5);
    assert.equal(result.current.realizedPrice, 120);
    assert.equal(result.current.nupl, 0.6);
    assert.equal(result.current.annualIssuancePercent, 0.7);
    assert.deepEqual(result.charts.realizedPrice.at(-1), [Date.parse("2026-06-11T00:00:00Z"), 120]);
    assert.deepEqual(result.charts.marketPrice.at(-1), [Date.parse("2026-06-11T00:00:00Z"), 125]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
