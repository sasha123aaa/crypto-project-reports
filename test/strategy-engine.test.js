import test from "node:test";
import assert from "node:assert/strict";
import { getStrategyConfig, calculateLevels, calculateAveragePrice, calculateCapitalPlan, calculateDynamicTake, buildStrategyPlan, evaluateVirtualTrade, evaluateStrategyPath } from "../public/assets/strategy-engine.js";

const range = { aTime:1, bTime:2, aPrice:100, bPrice:200, bullish:true };
const sampleRange = range;

test("entry modes choose expected multipliers", () => {
  assert.deepEqual(getStrategyConfig(0.31).qtyMultipliers.slice(0, 4), [1, 1, 1, 6.7]);
  assert.deepEqual(getStrategyConfig(0.50).qtyMultipliers.slice(0, 4), [1, 1, 3.3, 6.7]);
  assert.deepEqual(getStrategyConfig(0.75).qtyMultipliers.slice(0, 4), [1, 2, 4, 8]);
});

test("entry mode 0.31 starts from 0.31 with its own multipliers", () => {
  const levels = calculateLevels({ range:sampleRange, entryMode:0.31 });

  assert.equal(levels[0].ratio, 0.31);
  assert.equal(levels[0].qtyMultiplier, 1);
  assert.equal(levels[1].ratio, 0.50);
  assert.equal(levels[1].qtyMultiplier, 1);
  assert.equal(levels[2].ratio, 0.75);
  assert.equal(levels[2].qtyMultiplier, 1);
  assert.equal(levels[3].ratio, 1.00);
  assert.equal(levels[3].qtyMultiplier, 6.7);
});

test("entry mode 0.50 starts from 0.50 and does not include 0.31", () => {
  const levels = calculateLevels({ range:sampleRange, entryMode:0.5 });

  assert.equal(levels[0].ratio, 0.50);
  assert.equal(levels[0].qtyMultiplier, 1);
  assert.equal(levels[1].ratio, 0.75);
  assert.equal(levels[1].qtyMultiplier, 1);
  assert.equal(levels[2].ratio, 1.00);
  assert.equal(levels[2].qtyMultiplier, 3.3);

  assert.ok(!levels.some((level) => level.ratio === 0.31));
});

test("entry mode 0.75 starts from 0.75 and uses geometric multipliers from first level", () => {
  const levels = calculateLevels({ range:sampleRange, entryMode:0.75 });

  assert.equal(levels[0].ratio, 0.75);
  assert.equal(levels[0].qtyMultiplier, 1);
  assert.equal(levels[1].ratio, 1.00);
  assert.equal(levels[1].qtyMultiplier, 2);
  assert.equal(levels[2].ratio, 1.20);
  assert.equal(levels[2].qtyMultiplier, 4);

  assert.ok(!levels.some((level) => level.ratio === 0.31));
  assert.ok(!levels.some((level) => level.ratio === 0.50));
});

test("first active level is the selected entry mode", () => {
  const plan031 = buildStrategyPlan({ range:sampleRange, entryMode:0.31, currentPrice:sampleRange.bPrice });
  const plan050 = buildStrategyPlan({ range:sampleRange, entryMode:0.5, currentPrice:sampleRange.bPrice });
  const plan075 = buildStrategyPlan({ range:sampleRange, entryMode:0.75, currentPrice:sampleRange.bPrice });

  assert.equal(plan031.levels[0].ratio, 0.31);
  assert.equal(plan050.levels[0].ratio, 0.50);
  assert.equal(plan075.levels[0].ratio, 0.75);
});

test("levels are built in descending long order", () => {
  const levels = calculateLevels({ range, entryMode:0.5 });
  assert.equal(levels.length, 11);
  for (let i = 1; i < levels.length; i += 1) assert.ok(levels[i].price < levels[i - 1].price);
  assert.ok(levels.every((level) => level.price > 0));
});

test("average price changes after averaging", () => {
  const levels = calculateLevels({ range, entryMode:0.75 });
  const one = calculateAveragePrice([levels[0]]);
  const many = calculateAveragePrice([levels[0], levels[1], levels[2]]);
  assert.equal(one, levels[0].price);
  assert.ok(many < one);
});

test("used capital pct is calculated from multiplier plan", () => {
  const plan = buildStrategyPlan({ range, entryMode:0.75, currentPrice:125, capital:100 });
  const expected = plan.levels.filter((level) => plan.currentPrice <= level.price).reduce((sum, level) => sum + level.capitalPct, 0);
  assert.ok(Math.abs(plan.usedCapitalPct - expected) < 1e-9);
});

test("fixed take before 1.0 level and dynamic take after 1.0", () => {
  const levels = calculateLevels({ range, entryMode:0.75 });
  const fixed = calculateDynamicTake({ range, filledLevels:[levels[0]], currentPrice:125 });
  const dynamic = calculateDynamicTake({ range, filledLevels:[levels[0], levels[1]], currentPrice:90 });
  assert.equal(fixed.dynamicTakeMode, false);
  assert.equal(fixed.takePrice, 192);
  assert.equal(dynamic.dynamicTakeMode, true);
  assert.ok(dynamic.takePrice > 90);
});

test("active trade is not invalidated by later range change", () => {
  const levels = calculateLevels({ range, entryMode:0.5 });
  const trade = { status:"active", entryMode:0.5, range:{ ...range, bullish:false }, levels, activatedLevels:1, averagePrice:levels[0].price, maxDrawdownPct:0 };
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


test("buildStrategyPlan counts levels touched after B even when current price recovered above entry", () => {
  const candles = [
    { time:1, open:100, high:205, low:95, close:200 },
    { time:2, open:200, high:202, low:198, close:200 },
    { time:3, open:200, high:180, low:140, close:160 },
    { time:4, open:160, high:165, low:118, close:155 },
    { time:5, open:155, high:170, low:154, close:160 },
  ];
  const plan = buildStrategyPlan({ range, entryMode:0.5, candles, currentPrice:160 });
  assert.equal(plan.pathBased, true);
  assert.equal(plan.activatedLevels, 2);
  assert.ok(plan.averagePrice);
  assert.ok(plan.usedCapitalPct > 0);
});

test("buildStrategyPlan marks take_hit when price touches entry and then high reaches take", () => {
  const candles = [
    { time:1, open:100, high:205, low:95, close:200 },
    { time:2, open:200, high:202, low:198, close:200 },
    { time:3, open:200, high:193, low:140, close:192 },
  ];
  const plan = buildStrategyPlan({ range, entryMode:0.5, candles, currentPrice:192 });
  assert.equal(plan.status, "take_hit");
  assert.equal(plan.activatedLevels, 1);
});

test("evaluateStrategyPath reports no path when B candle is missing", () => {
  const state = evaluateStrategyPath({ range:{ ...range, bTime:99 }, levels:calculateLevels({ range, entryMode:0.5 }), candles:[{ time:1, close:200 }], currentPrice:200 });
  assert.equal(state.pathFound, false);
});
