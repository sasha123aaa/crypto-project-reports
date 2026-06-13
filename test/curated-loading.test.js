import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.js";

const projects = [
  ["mnt", "mnt", "MNT"],
  ["mantle", "mnt", "MNT"],
  ["near", "near", "NEAR"],
  ["near protocol", "near", "NEAR"],
];

async function withLiveMarket(run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/coins/markets")) {
      return new Response(JSON.stringify([{ current_price:1, market_cap:1_000_000, total_volume:100_000 }]), { headers:{ "content-type":"application/json" } });
    }
    return new Response("unavailable", { status:503 });
  };
  try { return await run(); } finally { globalThis.fetch = originalFetch; }
}

for (const [input, slug, ticker] of projects) {
  test(`curated ${input} builds when its static report is missing`, async () => {
    await withLiveMarket(async () => {
      const env = { ASSETS:{ fetch:async () => new Response("missing", { status:404 }) } };
      const response = await worker.fetch(new Request(`https://example.test/api/report/${encodeURIComponent(input)}`), env, {});
      const report = await response.json();

      assert.equal(response.status, 200);
      assert.equal(report.meta.slug, slug);
      assert.equal(report.meta.ticker, ticker);
      assert.equal(report.meta.project_resolution.source, "curated");
      assert.equal(report.meta.static_report.status, "missing");
      assert.equal(report.meta.static_report.fallback, "runtime-build");
      assert.equal(report.meta.data_status, "curated-runtime-partial");
      assert.notEqual(report.error, "Unknown project slug or ticker");
    });
  });
}
