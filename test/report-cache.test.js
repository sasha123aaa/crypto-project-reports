import test from "node:test";
import assert from "node:assert/strict";
import { REPORT_CACHE_VERSION, clearReportCache, getCachedReport, getFallbackReport, getPersistentReport, getPersistentResolution, reportQuality, responseFromSnapshot, runSingleFlight, setCachedReport, setPersistentReport, setPersistentResolution } from "../src/lib/report-cache.js";

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

test("report cache retains the last successful model as an outage fallback", () => {
  clearReportCache();
  setCachedReport("eth", { status:200, body:'{"ok":true}' }, { freshTtlMs:1, staleTtlMs:1 });
  assert.equal(getCachedReport("eth", Date.now() + 10), null);
  assert.equal(getFallbackReport("eth").status, 200);
  assert.equal(getFallbackReport("eth").cacheState, "fallback");
});

test("single flight deduplicates concurrent report builds", async () => {
  clearReportCache();
  let builds = 0;
  const producer = async () => { builds += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { status:200 }; };
  const [first, second] = await Promise.all([runSingleFlight("eth", producer), runSingleFlight("ETH", producer)]);
  assert.equal(builds, 1);
  assert.equal(first, second);
});

test("persistent KV stores last-known-good reports and project resolution separately", async () => {
  const values = new Map();
  const env = { REPORT_CACHE:{
    async get(key, options) { return options?.type === "json" && values.has(key) ? JSON.parse(values.get(key)) : null; },
    async put(key, value) { values.set(key, value); },
  } };
  const snapshot = { status:200, body:'{"ok":true}', contentType:"application/json" };
  await setPersistentReport(env, "ZEN", snapshot);
  await setPersistentResolution(env, "ZEN", { slug:"zen", ticker:"ZEN", coingeckoId:"zencash" });

  assert.equal((await getPersistentReport(env, "zen")).body, snapshot.body);
  assert.deepEqual(await getPersistentResolution(env, "zen"), { slug:"zen", ticker:"ZEN", coingeckoId:"zencash" });
  assert.ok(values.has(`${REPORT_CACHE_VERSION}:report:zen`));
  assert.ok(values.has(`${REPORT_CACHE_VERSION}:resolution:zen`));
});

test("cache responses expose canonical-resolution cache version", () => {
  const response = responseFromSnapshot({ status:200, body:"{}", contentType:"application/json", cacheControl:"public" });
  assert.equal(response.headers.get("x-report-cache-version"), REPORT_CACHE_VERSION);
});

test("higher-quality live reports replace fallback reports, but manual never replaces live", () => {
  clearReportCache();
  const partial = { status:200, body:'{"meta":{"source_state":"partial"}}' };
  const live = { status:200, body:'{"meta":{"source_state":"live"}}' };
  const manual = { status:200, body:'{"meta":{"source_state":"manual"}}' };
  setCachedReport("eth", partial);
  setCachedReport("eth", live);
  setCachedReport("eth", manual);
  assert.equal(reportQuality(getCachedReport("eth")), 5);
  assert.equal(getCachedReport("eth").body, live.body);
});

test("manual responses are not retained as last-known-good snapshots", async () => {
  clearReportCache();
  const manual = { status:200, body:'{"meta":{"source_state":"manual"}}' };
  setCachedReport("eth", manual);
  assert.equal(getCachedReport("eth"), null);

  const values = new Map();
  const env = { REPORT_CACHE:{
    async get(key, options) { return options?.type === "json" && values.has(key) ? JSON.parse(values.get(key)) : null; },
    async put(key, value) { values.set(key, value); },
  } };
  await setPersistentReport(env, "eth", manual);
  assert.equal(values.has("report:eth"), false);
});

test("stale last-known-good responses identify themselves as snapshots", async () => {
  const response = responseFromSnapshot({
    status:200,
    body:'{"meta":{"source_state":"live"},"market":{}}',
    contentType:"application/json",
    cacheControl:"public",
  }, "persistent-stale");
  const report = await response.json();
  assert.equal(report.meta.source_state, "snapshot");
  assert.equal(report.meta.snapshot_of, "live");
});
