import test from "node:test";
import assert from "node:assert/strict";
import { clearReportCache, getCachedReport, responseFromSnapshot, runSingleFlight, setCachedReport } from "../src/lib/report-cache.js";

test("report cache serves fresh then stale successful snapshots", () => {
  clearReportCache();
  setCachedReport("BTC", { status:200, body:'{"ok":true}', contentType:"application/json", cacheControl:"public" }, { freshTtlMs:10, staleTtlMs:100 });
  assert.equal(getCachedReport("btc", Date.now()).cacheState, "fresh");
  assert.equal(getCachedReport("btc", Date.now() + 20).cacheState, "stale");
  assert.equal(getCachedReport("btc", Date.now() + 200), null);
});

test("report cache does not store error responses and marks cache responses", async () => {
  clearReportCache();
  setCachedReport("bad", { status:503, body:"{}" });
  assert.equal(getCachedReport("bad"), null);
  const response = responseFromSnapshot({ status:200, body:"{}", contentType:"application/json", cacheControl:"public" }, "stale");
  assert.equal(response.headers.get("x-report-cache"), "stale");
});

test("single flight deduplicates concurrent report builds", async () => {
  clearReportCache();
  let builds = 0;
  const producer = async () => { builds += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { status:200 }; };
  const [first, second] = await Promise.all([runSingleFlight("eth", producer), runSingleFlight("ETH", producer)]);
  assert.equal(builds, 1);
  assert.equal(first, second);
});
