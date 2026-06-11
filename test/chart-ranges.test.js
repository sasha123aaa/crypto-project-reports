import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("all reusable dashboard time-series charts default to ALL", async () => {
  const source = await readFile(new URL("../public/assets/report.js", import.meta.url), "utf8");
  assert.match(source, /const DEFAULT_CHART_RANGE = "ALL";/);
  assert.match(source, /range === DEFAULT_CHART_RANGE \? " active" : ""/);
  assert.match(source, /applyPreset\(DEFAULT_CHART_RANGE\);/);
  assert.doesNotMatch(source, /applyPreset\("1Y"\)/);
});
