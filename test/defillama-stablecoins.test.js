import test from "node:test";
import assert from "node:assert/strict";
import { fetchStablecoinHistory, normalizeStablecoinHistory, stablecoinMcapUsd } from "../src/adapters/defillama.js";

test("stablecoin history requests DefiLlama's full chain chart endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl;
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response("[]", { status:200, headers:{ "content-type":"application/json" } });
  };
  try {
    await fetchStablecoinHistory("Ethereum");
    assert.equal(requestedUrl, "https://stablecoins.llama.fi/stablecoincharts/Ethereum");
  } finally { globalThis.fetch = originalFetch; }
});

test("stablecoinMcapUsd sums every USD-converted peg bucket", () => {
  assert.equal(stablecoinMcapUsd({ totalCirculatingUSD:{ peggedUSD:100, peggedEUR:"20", peggedJPY:5 } }), 125);
  assert.equal(stablecoinMcapUsd({ totalCirculatingUSD:160 }), 160);
});

test("normalizeStablecoinHistory preserves the full chronological history", () => {
  const rows = normalizeStablecoinHistory([
    { date:"1730419200", totalCirculatingUSD:{ peggedUSD:160, peggedEUR:10 } },
    { date:"1514764800", totalCirculatingUSD:{ peggedUSD:1 } },
    { date:"1514764800", totalCirculatingUSD:{ peggedUSD:2 } },
    { date:"1514851200", totalCirculatingUSD:{ peggedUSD:0 } },
  ]);
  assert.deepEqual(rows.map(({ date, totalCirculatingUSD }) => ({ date, totalCirculatingUSD })), [
    { date:1514764800, totalCirculatingUSD:2 },
    { date:1730419200, totalCirculatingUSD:170 },
  ]);
});

test("normalizeStablecoinHistory accepts a nested chart payload", () => {
  const rows = normalizeStablecoinHistory({ chart:[{ date:1514764800000, totalCirculatingUSD:{ peggedUSD:2, peggedEUR:1 } }] });
  assert.deepEqual(rows.map(({ date, totalCirculatingUSD }) => ({ date, totalCirculatingUSD })), [
    { date:1514764800, totalCirculatingUSD:3 },
  ]);
});
