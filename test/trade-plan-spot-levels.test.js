import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../public/assets/trade-plan.js", import.meta.url), "utf8");
const fibPriceSource = source.match(/function fibPrice[\s\S]*?(?=\nfunction buildPlan)/)[0];
const buildPlanSource = source.match(/function buildPlan[\s\S]*?(?=\nfunction buildCandles)/)[0];
const context = { allocations: { entry: 10, average1: 10, average2: 20, average3: 60 } };
vm.runInNewContext(`${fibPriceSource}\n${buildPlanSource}`, context);

test("spot plan stops before non-positive averaging levels", () => {
  const range = { bullish: true, aPrice: 0.2873, bPrice: 3.66, bTime: 1 };
  const plan = context.buildPlan(range, [{ time: 1, low: 0.2 }]);

  assert.deepEqual(Object.keys(plan.levels), ["entry", "average1", "take"]);
  assert.ok(Object.values(plan.levels).every(({ value }) => value > 0));
  assert.equal(plan.active, "average1");
});

test("spot plan keeps all fib levels when each price is positive", () => {
  const range = { bullish: true, aPrice: 80, bPrice: 100, bTime: 1 };
  const plan = context.buildPlan(range, [{ time: 1, low: 95 }]);

  assert.deepEqual(Object.keys(plan.levels), ["entry", "average1", "average2", "average3", "take"]);
  assert.ok(Object.values(plan.levels).every(({ value }) => value > 0));
});
