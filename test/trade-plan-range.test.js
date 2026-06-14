import test from "node:test";
import assert from "node:assert/strict";
import { activeRangeForCandles, analysisCandlesForRange, RANGE_ANALYSIS_CANDLE_LIMIT } from "../src/adapters/bybit.js";

test("trade plan and quick TA share a fixed 500-candle analysis window", () => {
  const candles = Array.from({ length: 1000 }, (_, time) => ({ time, open:time, high:time + 2, low:time - 2, close:time + 1 }));
  const analysis = analysisCandlesForRange(candles);
  assert.equal(RANGE_ANALYSIS_CANDLE_LIMIT, 500);
  assert.equal(analysis.length, 500);
  assert.equal(analysis[0].time, 500);
  assert.deepEqual(activeRangeForCandles(candles).analysisCandles, analysis);
});
