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
  assert.match(source, /\["macro", "meme"\]\.includes\(category\)/);
  assert.match(source, /metricSlotsHtml\(report, "tokenomics"\)/);
  assert.match(source, /metricSlotsHtml\(report, "financial"\)/);
  assert.match(source, /metricSlotsHtml\(report, "capital"\)/);
});


test("report renderer follows profile section order and keeps news in the closing flow", async () => {
  const source = await readFile(new URL("../public/assets/report.js", import.meta.url), "utf8");
  assert.match(source, /function orderedReportSectionsHtml\(report\)/);
  assert.match(source, /report\?\.meta\?\.section_order/);
  assert.match(source, /narrative_and_news: \(\) => newsHtml\(report\.news, report\)/);
  assert.ok(source.indexOf("summary: () =>") < source.indexOf("final_verdict: () =>"));
  assert.ok(source.indexOf("final_verdict: () =>") < source.indexOf("narrative_and_news: () =>"));
});

test("report renderer uses unified product-language labels", async () => {
  const source = await readFile(new URL("../public/assets/report.js", import.meta.url), "utf8");
  assert.match(source, /<div class="section-title">Финальная оценка<\/div>/);
  assert.match(source, /<strong>Краткий вывод<\/strong>/);
  assert.match(source, /<h3>Ограничения<\/h3>/);
  assert.match(source, /<h3>Риски<\/h3>/);
  assert.match(source, /Источник: \${escapeHtml\(sourceLabel\(metric\?\.source\)\)}/);
  assert.doesNotMatch(source, /АКТУАЛЬНО|СТАТИКА|ВРУЧНУЮ|РАСЧЕТ|НЕИЗВЕСТНО/);
});
