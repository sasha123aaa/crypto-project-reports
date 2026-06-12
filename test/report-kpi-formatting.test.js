import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("KPI renderer compacts only large raw numeric metric values", async () => {
  const source = await readFile(new URL("../public/assets/report.js", import.meta.url), "utf8");
  assert.match(source, /function metricFormattedValue\(metric\)/);
  assert.match(source, /Number\.isFinite\(value\) && Math\.abs\(value\) >= 1e3/);
  assert.match(source, /isRawNumericFormat/);
  assert.match(source, /escapeHtml\(metricFormattedValue\(metric\)\)/);
});


test("KPI renderer hides unavailable placeholders and uses profile-aware metric slots", async () => {
  const source = await readFile(new URL("../public/assets/report.js", import.meta.url), "utf8");
  assert.match(source, /function isRenderableMetric\(metric\)/);
  assert.match(source, /metric\.status === "unavailable"/);
  assert.match(source, /function metricSlotsHtml\(report, slot\)/);
  assert.match(source, /function metricSlotsExcludingHtml\(report, slot, excludeKeys\)/);
  assert.match(source, /category === "meme"/);
  assert.match(source, /metricSlotsHtml\(data, "tokenomics"\)/);
  assert.match(source, /metricSlotsHtml\(data, "financial"\)/);
  assert.match(source, /metricSlotsHtml\(data, "capital"\)/);
});
