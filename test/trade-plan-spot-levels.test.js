import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("public/assets/trade-plan.js", "utf8");
const loadChartSource = source.match(/async function loadChart[\s\S]*?(?=\n    function updateTimer)/)?.[0] || "";

test("trade-plan loadChart does not build legacy plan or pass plan levels to chart", () => {
  assert.doesNotMatch(loadChartSource, /buildPlan\(/);
  assert.doesNotMatch(loadChartSource, /updatePlan\(/);
  assert.doesNotMatch(loadChartSource, /plan\.levels/);
  assert.match(loadChartSource, /levels:\{\}/);
  assert.match(loadChartSource, /showPlan:false/);
});

test("trade-plan markup uses strategy summary blocks instead of legacy scenario blocks", () => {
  assert.doesNotMatch(source, /Уровни сценария/);
  assert.doesNotMatch(source, /Распределение позиции/);
  assert.doesNotMatch(source, /Состояние торгового плана/);
  assert.match(source, /Сводка стратегии/);
  assert.match(source, /Состояние стратегии/);
  assert.match(source, /strategy-summary-cards/);
  assert.match(source, /strategy-checklist/);
  assert.match(source, /strategy-action/);
});

test("trade-plan source no longer contains legacy 10 10 20 60 allocation UI", () => {
  assert.doesNotMatch(source, /allocations=\{entry:10,average1:10,average2:20,average3:60\}/);
  assert.doesNotMatch(source, /Вход 10%/);
  assert.doesNotMatch(source, /Уср\. 1 10%/);
  assert.doesNotMatch(source, /Уср\. 2 20%/);
  assert.doesNotMatch(source, /Уср\. 3 60%/);
});

