import test from "node:test";
import assert from "node:assert/strict";
import { fetchDefiLlamaRwaActiveMcap, findRwaChainValue } from "../src/adapters/defillama.js";

test("findRwaChainValue supports keyed chains and real-world active market cap field variants", () => {
  assert.equal(findRwaChainValue({ chains:{ ethereum:{ displayName:"Ethereum", totalRwaActiveMarketcap:14_400_000_000 } } }, "Ethereum"), 14_400_000_000);
  assert.equal(findRwaChainValue([{ chain_name:"ethereum", metrics:{}, active_marketcap:"14400000000" }], "Ethereum"), 14_400_000_000);
});

test("fetchDefiLlamaRwaActiveMcap falls back from retired APIs to the public chain page and exposes debug", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.llama.fi/rwa")) return new Response("Not Found", { status:404 });
    return new Response("<html><body><div>Total RWA Active Mcap $14.41b</div></body></html>", { status:200, headers:{ "content-type":"text/html" } });
  };
  try {
    const result = await fetchDefiLlamaRwaActiveMcap("Ethereum");
    assert.equal(result.value, 14_410_000_000);
    assert.equal(result.source, "DefiLlama RWA");
    assert.equal(result.debug.attempts.length, 3);
    assert.deepEqual(result.debug.attempts.slice(0, 2).map((attempt) => attempt.status), [404, 404]);
    assert.equal(result.debug.attempts[2].reason, "matched visible Total RWA Active Mcap");
  } finally { globalThis.fetch = originalFetch; }
});

test("fetchDefiLlamaRwaActiveMcap includes attempt reasons when all sources fail", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("Not Found", { status:404 });
  try {
    await assert.rejects(() => fetchDefiLlamaRwaActiveMcap("Ethereum"), (error) => {
      assert.equal(error.debug.attempts.length, 3);
      assert.match(error.message, /HTTP 404/);
      return true;
    });
  } finally { globalThis.fetch = originalFetch; }
});
