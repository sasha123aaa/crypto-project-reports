import test from "node:test";
import assert from "node:assert/strict";
import { fetchAppFeesOverview, fetchChainFeesOverview } from "../src/adapters/defillama.js";

test("fee adapters request separate app and base-chain histories", async () => {
  const originalFetch = globalThis.fetch;
  const urls = [];
  globalThis.fetch = async (url) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ total24h:1, totalDataChart:[[1, 1]] }), { status:200 });
  };
  try {
    await fetchAppFeesOverview("Ethereum");
    await fetchChainFeesOverview("Ethereum");
    assert.match(urls[0], /\/overview\/fees\/Ethereum/);
    assert.match(urls[1], /\/summary\/fees\/ethereum/);
    assert.ok(urls.every((url) => url.includes("dataType=dailyFees")));
    assert.ok(urls.every((url) => url.includes("excludeTotalDataChart=false")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
