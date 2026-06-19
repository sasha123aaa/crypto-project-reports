import test from "node:test";
import assert from "node:assert/strict";
import { replayStrategyOnCandles } from "../src/lib/strategy-replay.js";

function candle(time, { low = 195, high = 205, close = 200 } = {}) {
  return { time, open:close, high, low, close };
}

const range1 = { aTime:1, bTime:2, aPrice:100, bPrice:200, bullish:true };
const range2 = { aTime:8, bTime:9, aPrice:100, bPrice:220, bullish:true };

function padCandles(items) {
  const prefix = Array.from({ length:50 }, (_, index) => candle(index + 1));
  return [...prefix, ...items.map((item, index) => candle(index + 51, item))];
}

function replay(candles, detector) {
  return replayStrategyOnCandles({
    symbol:"LINKUSDT",
    baseSymbol:"LINK",
    exchange:"BYBIT",
    timeframe:"1h",
    entryMode:0.5,
    candles,
    capital:100,
    rangeDetector:detector,
  });
}

test("sequential replay stops after first unfinished trade", () => {
  const candles = padCandles([
    {},
    { low:140, high:170, close:160 },
    { high:170, low:160, close:165 }, { high:170, low:160, close:165 }, { low:140, high:180, close:170 },
  ]);
  const result = replay(candles, (history) => history.length >= 51 ? (history.length >= 54 ? range2 : range1) : null);
  assert.equal(result.trades.length, 1);
  assert.equal(result.trades.filter((trade) => trade.status !== "take_hit").length, 1);
  assert.notEqual(result.trades[0].status, "take_hit");
});

test("sequential replay allows a new trade only after previous take", () => {
  const candles = padCandles([
    {},
    { low:140, high:193, close:192 },
    {}, {}, {},
    { low:140, high:212, close:210 },
  ]);
  const result = replay(candles, (history) => history.length >= 55 ? range2 : (history.length >= 51 ? range1 : null));
  assert.equal(result.trades.length, 2);
  assert.ok(new Date(result.trades[1].openedAt).getTime() > new Date(result.trades[0].closedAt).getTime());
});

test("sequential replay contains no overlapping historical intervals", () => {
  const candles = padCandles([{}, { low:140, high:193, close:192 }, {}, {}, {}, { low:140, high:212, close:210 }]);
  const { trades } = replay(candles, (history) => history.length >= 55 ? range2 : (history.length >= 51 ? range1 : null));
  for (let i = 1; i < trades.length; i += 1) assert.ok(new Date(trades[i].openedAt).getTime() > new Date(trades[i - 1].closedAt).getTime());
});

test("sequential replay leaves at most one unfinished trade", () => {
  const candles = padCandles([{}, { low:140, high:170, close:160 }, {}, {}, { low:140, high:170, close:160 }]);
  const { trades } = replay(candles, (history) => history.length >= 51 ? range1 : null);
  assert.ok(trades.filter((trade) => trade.status !== "take_hit").length <= 1);
});

test("same range is not created twice", () => {
  const candles = padCandles([{}, { low:140, high:193, close:192 }, {}, { low:140, high:193, close:192 }]);
  const { trades } = replay(candles, (history) => history.length >= 51 ? range1 : null);
  assert.equal(trades.length, 1);
});

test("search resumes after take candle instead of restarting history", () => {
  const candles = padCandles([{}, { low:140, high:193, close:192 }, { low:140, high:193, close:192 }, {}, {}, { low:140, high:212, close:210 }]);
  const calls = [];
  const { trades } = replay(candles, (history) => { calls.push(history.length); return history.length >= 55 ? range2 : (history.length >= 51 ? range1 : null); });
  assert.equal(trades.length, 2);
  assert.equal(calls.filter((value) => value === 51).length, 1);
});

test("openedIndex and closedIndex are not persisted on final trades", () => {
  const candles = padCandles([{}, { low:140, high:193, close:192 }]);
  const { trades } = replay(candles, (history) => history.length >= 51 ? range1 : null);
  assert.equal("openedIndex" in trades[0], false);
  assert.equal("closedIndex" in trades[0], false);
});
