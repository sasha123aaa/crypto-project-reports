import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const radarJs = readFileSync(new URL("../public/assets/bull-radar.js", import.meta.url), "utf8");
const radarHtml = readFileSync(new URL("../public/bull-radar/index.html", import.meta.url), "utf8");

test("bull radar UI no longer exposes old averaging controls or columns", () => {
  for (const oldControl of ["entry-fib-range", "entry-fib-number", "average-count", "average-fibs"]) {
    assert.equal(radarHtml.includes(oldControl), false);
  }

  for (const oldColumn of [">Уср. 1<", ">Уср. 2<", ">Уср. 3<"]) {
    assert.equal(radarHtml.includes(oldColumn), false);
  }

  for (const newColumn of ["Режим", "Вход", "Ближ. уср.", "Тейк", "Исполнено", "Задействовано"]) {
    assert.equal(radarHtml.includes(newColumn), true);
  }
});

test("bull radar uses strategy mode and StrategyEngine for plan preview", () => {
  assert.match(radarJs, /function settings\(\) \{[\s\S]*strategyMode:\$\("radar-strategy-mode"\)\?\.value \|\| "auto"/);
  assert.match(radarJs, /function buildRadarStrategyPreview\(row\) \{[\s\S]*window\.StrategyEngine[\s\S]*engine\.calculateLevels[\s\S]*engine\.buildStrategyPlan/);
  assert.match(radarJs, /function tradePlanUrl\(row\) \{[\s\S]*strategyMode:String\(mode\)/);
});

test("bull radar does not feed legacy average levels to the chart", () => {
  const renderChartBody = radarJs.match(/function renderChart\(\) \{[\s\S]*?\n  function renderAll\(\)/)?.[0] || "";
  assert.equal(renderChartBody.includes("average1"), false);
  assert.equal(renderChartBody.includes("average2"), false);
  assert.equal(renderChartBody.includes("average3"), false);
  assert.match(renderChartBody, /activeStrategyTrade:strategy/);
  assert.match(renderChartBody, /showPlan:false/);
});

test("bull radar main logic no longer uses legacy entryFib averageCount avgFibs settings", () => {
  const forbidden = ["buildRadarLevels", "chartLevels", "settings.entryFib", "settings.averageCount", "settings.avgFibs", "s.entryFib", "s.averageCount", "s.avgFibs"];
  for (const token of forbidden) assert.equal(radarJs.includes(token), false, token);
});
