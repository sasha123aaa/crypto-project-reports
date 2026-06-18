import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/assets/trade-plan.js", import.meta.url), "utf8");
const fibPriceSource = source.match(/function fibPrice[\s\S]*?(?=\nfunction buildPlan)/)[0];
const buildPlanSource = source.match(/function buildPlan[\s\S]*?(?=\nfunction buildCandles)/)[0];
const context = { allocations: { entry: 10, average1: 10, average2: 20, average3: 60 } };
vm.runInNewContext(`${fibPriceSource}\n${buildPlanSource}`, context);

test("spot plan switches to logarithmic fibs instead of dropping non-positive linear levels", () => {
  const range = { bullish: true, aPrice: 0.2873, bPrice: 3.66, bTime: 1 };
  const plan = context.buildPlan(range, [{ time: 1, low: 0.001 }]);

  assert.deepEqual(Object.keys(plan.levels), ["entry", "average1", "average2", "average3", "take"]);
  assert.ok(Object.values(plan.levels).every(({ value }) => value > 0));
  assert.equal(plan.logBased, true);
  assert.ok(Math.abs(plan.levels.entry.value - Math.sqrt(3.66 * 0.2873)) < 1e-12);
  assert.ok(Math.abs(plan.levels.average1.value - 0.2873) < 1e-12);
  assert.ok(Math.abs(plan.levels.average2.value - 0.2873 * Math.sqrt(0.2873 / 3.66)) < 1e-12);
  assert.ok(Math.abs(plan.levels.average3.value - 0.2873 ** 2 / 3.66) < 1e-12);
  assert.equal(plan.active, "average3");
});

test("spot plan keeps all fib levels when each price is positive", () => {
  const range = { bullish: true, aPrice: 80, bPrice: 100, bTime: 1 };
  const plan = context.buildPlan(range, [{ time: 1, low: 95 }]);

  assert.deepEqual(Object.keys(plan.levels), ["entry", "average1", "average2", "average3", "take"]);
  assert.ok(Object.values(plan.levels).every(({ value }) => value > 0));
  assert.equal(plan.logBased, false);
  assert.equal(plan.levels.entry.value, 90);
  assert.equal(plan.levels.average3.value, 60);
});

test("logarithmic spot plan uses the same fib mode for the active take", () => {
  const range = { bullish: true, aPrice: 1, bPrice: 10, bTime: 1 };
  const plan = context.buildPlan(range, [{ time: 1, low: 0.01 }]);

  assert.equal(plan.logBased, true);
  assert.equal(plan.takeFib, 1.4);
  assert.ok(Math.abs(plan.levels.take.value - 10 * (0.1 ** 1.4)) < 1e-12);
});


test("strategy preview touched levels are rendered as candle touches", async () => {
  const source = await import("node:fs/promises").then(fs => fs.readFile("public/assets/trade-plan.js", "utf8"));
  assert.match(source, /return "Касание было"/);
  assert.doesNotMatch(source, /return "Цена ниже уровня"/);
});
