import test from "node:test";
import assert from "node:assert/strict";
import { getStrategyConfig, calculateLevels, calculateAveragePrice, calculateCapitalPlan, calculateDynamicTake, calculateBc29Take, buildStrategyPlan, evaluateVirtualTrade, evaluateStrategyPath } from "../public/assets/strategy-engine.js";

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
  const validLevels = levels.filter((level) => level.valid !== false);
  for (let i = 1; i < validLevels.length; i += 1) assert.ok(validLevels[i].price < validLevels[i - 1].price);
  assert.ok(validLevels.every((level) => level.price > 0));
  assert.ok(levels.filter((level) => level.valid === false).every((level) => level.price === null));
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

test("fixed take before 1.0 level and BC29 dynamic take after 1.0", () => {
  const levels = calculateLevels({ range, entryMode:0.31 });
  const fixed = calculateDynamicTake({ range, filledLevels:levels.slice(0, 3), currentIndex:1, candles:[{ time:2, low:198 }, { time:3, low:125 }] });
  const dynamic = calculateDynamicTake({ range, filledLevels:levels.slice(0, 4), currentIndex:1, candles:[{ time:2, low:198 }, { time:3, low:90 }], averagePrice:80 });
  assert.equal(fixed.dynamicTakeMode, false);
  assert.equal(fixed.takePrice, 192);
  assert.equal(dynamic.dynamicTakeMode, true);
  assert.equal(dynamic.anchorB, 200);
  assert.equal(dynamic.extremeC, 90);
  assert.equal(dynamic.takePrice, 121.9);
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

test("buildStrategyPlan levelStates mark 0.31 entry and first two averages executed after B low touch", () => {
  const candles = [
    { time:1, open:100, high:205, low:95, close:200 },
    { time:2, open:200, high:202, low:198, close:200 },
    { time:3, open:200, high:170, low:118, close:180 },
    { time:4, open:180, high:210, low:175, close:205 },
  ];
  const plan = buildStrategyPlan({ range, entryMode:0.31, candles, currentPrice:205 });
  assert.deepEqual(plan.levelStates.slice(0, 3).map((level) => level.state), ["executed", "executed", "executed"]);
  assert.equal(plan.levels[1].state, "executed");
  assert.equal(plan.levelStates[1].executedAt, 3);
});

test("take_hit result is fixed at take price and separated from later market price", () => {
  const candles = [
    { time:1, open:100, high:205, low:95, close:200 },
    { time:2, open:200, high:202, low:198, close:200 },
    { time:3, open:200, high:180, low:140, close:150 },
    { time:4, open:150, high:193, low:149, close:192 },
    { time:5, open:192, high:193, low:80, close:85 },
  ];
  const plan = buildStrategyPlan({ range, entryMode:0.5, candles, currentPrice:85 });

  assert.equal(plan.status, "take_hit");
  assert.ok(plan.resultPct > 0);
  assert.ok(plan.currentPnlPct > 0);
  assert.equal(plan.closePrice, plan.takePrice);
  assert.equal(plan.currentPrice, plan.closePrice);
  assert.equal(plan.marketPrice, 85);
  assert.notEqual(plan.marketPrice, plan.closePrice);
  assert.equal(plan.openedAt, 3);
  assert.equal(plan.closedAt, 4);
  assert.equal(plan.realizedResultPct, plan.resultPct);
  assert.ok(Math.abs(plan.resultOnFullCapitalPct - plan.resultPct * (plan.usedCapitalPct / 100)) < 1e-9);
});

test("closed take_hit trade stays fixed at take price after market drop", () => {
  const updated = evaluateVirtualTrade({
    trade:{ status:"take_hit", averagePrice:166.36, takePrice:173.0044, currentPrice:160, resultPct:3.99399, usedCapitalPct:0.06 },
    currentPrice:150,
  });
  assert.equal(updated.status, "take_hit");
  assert.equal(updated.currentPrice, 173.0044);
  assert.ok(updated.resultPct > 0);
  assert.equal(updated.currentPnlPct, updated.resultPct);
});

test("new take hit closes at take price instead of higher market price", () => {
  const updated = evaluateVirtualTrade({
    trade:{ status:"active", averagePrice:166.36, takePrice:173, usedCapitalPct:10, activatedLevels:1, levels:[] },
    currentPrice:180,
  });
  assert.equal(updated.status, "take_hit");
  assert.equal(updated.currentPrice, 173);
  assert.ok(Math.abs(updated.resultPct - ((173 - 166.36) / 166.36 * 100)) < 1e-9);
  assert.notEqual(updated.resultPct, ((180 - 166.36) / 166.36 * 100));
});


test("BC29 exact example and monotonic C behavior", () => {
  const take = calculateBc29Take({ anchorB:67.78, extremeC:65.61, direction:"long" });
  assert.ok(Math.abs(take - 66.2393) < 0.000001);
  const lower = calculateBc29Take({ anchorB:67.78, extremeC:65.40, direction:"long" });
  assert.ok(Math.abs(lower - 66.0902) < 0.000001);
  assert.ok(lower < take);
  const unchanged = calculateDynamicTake({ range:{ aTime:1, bTime:2, aPrice:65.85, bPrice:67.78, bullish:true }, filledLevels:[{ ratio:1, price:65.85, qtyMultiplier:1 }], candles:[{ time:2, low:67.7 }, { time:3, low:65.9 }], currentIndex:1, previousExtremeC:65.40, previousTakePrice:lower, averagePrice:65.5 });
  assert.equal(unchanged.extremeC, 65.40);
  assert.ok(Math.abs(unchanged.takePrice - lower) < 0.000001);
});

test("BC29 average price protection keeps active trade without take_hit", () => {
  const levels = [{ ratio:1, price:65.85, qtyMultiplier:1, capitalPct:100 }];
  const dynamic = calculateDynamicTake({ range:{ aTime:1, bTime:2, aPrice:65.85, bPrice:67.78, bullish:true }, filledLevels:levels, candles:[{ time:2, low:67.7 }, { time:3, low:65.61 }], currentIndex:1, averagePrice:66.30 });
  assert.equal(dynamic.dynamicTakeMode, true);
  assert.equal(dynamic.takePrice, null);
  const trade = evaluateVirtualTrade({ trade:{ status:"active", range:{ aTime:1, bTime:2, aPrice:65.85, bPrice:67.78, bullish:true }, levels, activatedLevels:1, averagePrice:66.30 }, candles:[{ time:3, high:66.5, low:65.61, close:66.4 }] });
  assert.notEqual(trade.status, "take_hit");
});

test("new BC29 take is not executable on the same candle it is lowered", () => {
  const localRange = { aTime:1, bTime:2, aPrice:100, bPrice:200, bullish:true };
  const levels = calculateLevels({ range:localRange, entryMode:0.75 });
  const state = evaluateStrategyPath({ range:localRange, levels, candles:[
    { time:1, open:100, high:100, low:100, close:100 },
    { time:2, open:200, high:200, low:200, close:200 },
    { time:3, open:200, high:160, low:100, close:120 },
  ], currentPrice:120 });
  assert.notEqual(state.status, "take_hit");
  assert.equal(state.dynamicTakeMode, true);
  assert.equal(state.dynamicExtremeC, 100);
  assert.equal(state.takePrice, 129);
});

test("evaluateVirtualTrade does not close on the same candle that lowers dynamic take", () => {
  const localRange = { aTime:1, bTime:2, aPrice:100, bPrice:200, bullish:true, dynamicAnchorB:200 };
  const levels = [{ ratio:1, price:110, qtyMultiplier:1, capitalPct:100 }];
  const updated = evaluateVirtualTrade({
    trade:{ status:"active", range:localRange, levels, activatedLevels:1, averagePrice:120, takePrice:164.5, dynamicTakeMode:true },
    candles:[{ time:2, open:200, high:200, low:200, close:200 }, { time:3, open:140, high:130, low:100, close:120 }],
  });
  assert.notEqual(updated.status, "take_hit");
  assert.equal(updated.dynamicExtremeC, 100);
  assert.equal(updated.takePrice, 129);
});

test("calculateLevels matches Python linear formula for all 12 ratios", () => {
  const range = { aPrice:65.85, bPrice:67.78, bullish:true };
  const levels = calculateLevels({ range, entryMode:0.31 });
  const ratios = [0.31, 0.5, 0.75, 1, 1.2, 1.42, 1.68, 2, 2.38, 2.85, 3.4, 4.1];
  assert.equal(levels.length, ratios.length);
  ratios.forEach((ratio, index) => {
    const expected = 67.78 - (67.78 - 65.85) * ratio;
    assert.equal(levels[index].ratio, ratio);
    assert.ok(Math.abs(levels[index].price - expected) < 1e-12);
    assert.equal(levels[index].valid, true);
    assert.equal(levels[index].levelMode, "linear");
  });
});

test("calculateLevels keeps wide ranges linear and marks non-positive levels invalid", () => {
  const range = { aPrice:50, bPrice:100, bullish:true };
  const levels = calculateLevels({ range, entryMode:0.31 });
  assert.equal(levels[0].price, 100 - (100 - 50) * 0.31);
  assert.equal(levels[1].price, 100 - (100 - 50) * 0.5);
  const invalid = levels.filter((level) => level.rawPrice <= 0);
  assert.ok(invalid.length > 0);
  invalid.forEach((level) => {
    assert.equal(level.valid, false);
    assert.equal(level.price, null);
    assert.equal(level.invalidReason, "non_positive_linear_price");
    assert.equal(level.levelMode, "linear");
  });
});
