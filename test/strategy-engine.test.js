import test from "node:test";
import assert from "node:assert/strict";
import { getStrategyConfig, calculateLevels, calculateAveragePrice, calculateCapitalPlan, calculateDynamicTake, buildStrategyPlan, evaluateVirtualTrade } from "../public/assets/strategy-engine.js";

const range = { aTime:1, bTime:2, aPrice:100, bPrice:200, bullish:true };

test("entry modes choose expected multipliers", () => {
  assert.deepEqual(getStrategyConfig(0.31).qtyMultipliers.slice(0, 4), [1, 1, 1, 6.7]);
  assert.deepEqual(getStrategyConfig(0.50).qtyMultipliers.slice(0, 4), [1, 1, 3.3, 6.7]);
  assert.deepEqual(getStrategyConfig(0.75).qtyMultipliers.slice(0, 4), [1, 2, 4, 8]);
});

test("levels are built in descending long order", () => {
  const levels = calculateLevels({ range, entryMode:0.5 });
  assert.equal(levels.length, 12);
  for (let i = 1; i < levels.length; i += 1) assert.ok(levels[i].price < levels[i - 1].price);
  assert.ok(levels.every((level) => level.price > 0));
});

test("average price changes after averaging", () => {
  const levels = calculateLevels({ range, entryMode:0.75 });
  const one = calculateAveragePrice([levels[2]]);
  const many = calculateAveragePrice([levels[2], levels[3], levels[4]]);
  assert.equal(one, levels[2].price);
  assert.ok(many < one);
});

test("used capital pct is calculated from multiplier plan", () => {
  const plan = buildStrategyPlan({ range, entryMode:0.75, currentPrice:125, capital:100 });
  const expected = plan.levels.filter((level) => level.index >= 2 && plan.currentPrice <= level.price).reduce((sum, level) => sum + level.capitalPct, 0);
  assert.ok(Math.abs(plan.usedCapitalPct - expected) < 1e-9);
});

test("fixed take before 1.0 level and dynamic take after 1.0", () => {
  const levels = calculateLevels({ range, entryMode:0.75 });
  const fixed = calculateDynamicTake({ range, filledLevels:[levels[2]], currentPrice:125 });
  const dynamic = calculateDynamicTake({ range, filledLevels:[levels[2], levels[3]], currentPrice:90 });
  assert.equal(fixed.dynamicTakeMode, false);
  assert.equal(fixed.takePrice, 192);
  assert.equal(dynamic.dynamicTakeMode, true);
  assert.ok(dynamic.takePrice > 90);
});

test("active trade is not invalidated by later range change", () => {
  const levels = calculateLevels({ range, entryMode:0.5 });
  const trade = { status:"active", entryMode:0.5, range:{ ...range, bullish:false }, levels, activatedLevels:1, averagePrice:levels[1].price, maxDrawdownPct:0 };
  const updated = evaluateVirtualTrade({ trade, currentPrice:150 });
  assert.notEqual(updated.status, "invalidated");
});

test("take hit closes trade", () => {
  const levels = calculateLevels({ range, entryMode:0.5 });
  const updated = evaluateVirtualTrade({ trade:{ status:"active", entryMode:0.5, range, levels, activatedLevels:1, takePrice:192 }, currentPrice:193 });
  assert.equal(updated.status, "take_hit");
});

test("drawdown updates max drawdown", () => {
  const levels = calculateLevels({ range, entryMode:0.5 });
  const updated = evaluateVirtualTrade({ trade:{ status:"active", entryMode:0.5, range, levels, activatedLevels:1, averagePrice:150, maxDrawdownPct:-2 }, currentPrice:120 });
  assert.equal(updated.status, "drawdown");
  assert.ok(updated.maxDrawdownPct < -2);
});
