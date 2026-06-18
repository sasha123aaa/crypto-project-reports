import { buildStrategyPlan, calculateAveragePrice, calculateDynamicTake, evaluateStrategyPath } from "../../public/assets/strategy-engine.js";

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoTime(value) {
  if (value == null) return null;
  if (typeof value === "string") return value;
  const n = Number(value);
  if (Number.isFinite(n)) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  return String(value);
}

function defaultRangePayload(rawRange, analysisCandles = []) {
  if (!rawRange) return null;
  const aIndex = rawRange[0], bIndex = rawRange[1], aPrice = finite(rawRange[2]), bPrice = finite(rawRange[3]);
  if (!(aPrice > 0 && bPrice > 0)) return null;
  return {
    aTime:analysisCandles[aIndex]?.time,
    bTime:analysisCandles[bIndex]?.time,
    aPrice,
    bPrice,
    bullish:Boolean(rawRange[4]),
    heightPct:Math.abs((bPrice - aPrice) / aPrice) * 100,
    ageBars:Math.max(0, analysisCandles.length - 1 - bIndex),
  };
}

function normalizeDetectedRange(detected) {
  if (!detected) return null;
  if (detected.range && !Array.isArray(detected.range) && detected.range.aTime) return detected.range;
  if (Array.isArray(detected.range)) return defaultRangePayload(detected.range, detected.analysisCandles);
  if (detected.aTime) return detected;
  return null;
}

function backfillTradeId({ exchange, symbol, timeframe, entryMode, range }) {
  return [`BACKFILL`, exchange, symbol, timeframe, entryMode, range?.aTime || "a", range?.bTime || "b"].join(":");
}

function event(tradeId, eventType, candle, price, levelIndex, payload = {}) {
  return { tradeId, eventType, eventTime:isoTime(candle?.time) || new Date().toISOString(), price, levelIndex, payload };
}

function replayPlan({ plan, range, candles, startIndex, tradeId, timeframe, entryMode }) {
  const levels = Array.isArray(plan?.levels) ? plan.levels : [];
  const filled = [];
  const events = [];
  let openedAt = null;
  let closedAt = null;
  let status = "waiting_entry";
  let takePrice = null;
  let averagePrice = null;
  let usedCapitalPct = 0;
  let currentPrice = null;
  let maxDrawdownPct = 0;
  let resultPct = null;
  let resultOnFullCapitalPct = null;

  for (let i = startIndex + 1; i < candles.length; i++) {
    const candle = candles[i];
    const low = finite(candle?.low);
    const high = finite(candle?.high);
    const close = finite(candle?.close) ?? high ?? low;
    if (!(low > 0 || high > 0 || close > 0)) continue;
    currentPrice = close;

    for (let levelIndex = filled.length; levelIndex < levels.length; levelIndex++) {
      const level = levels[levelIndex];
      const price = finite(level?.price);
      if (price > 0 && low != null && low <= price) {
        filled.push(level);
        averagePrice = calculateAveragePrice(filled);
        usedCapitalPct = filled.reduce((sum, l) => sum + (finite(l?.capitalPct) || 0), 0);
        const payload = { source:"backfill", timeframe, entryMode, candleTime:isoTime(candle?.time), level };
        if (!openedAt) {
          openedAt = isoTime(candle?.time) || new Date().toISOString();
          status = "active";
          events.push(event(tradeId, "opened", candle, price, 0, payload));
        } else {
          status = "averaging";
          events.push(event(tradeId, "level_filled", candle, price, levelIndex, payload));
        }
      } else {
        break;
      }
    }

    if (!openedAt) continue;
    const take = calculateDynamicTake({ range, filledLevels:filled, candles:candles.slice(0, i + 1), currentPrice:close });
    takePrice = take.takePrice;
    if (averagePrice && low != null) maxDrawdownPct = Math.min(maxDrawdownPct, (low - averagePrice) / averagePrice * 100);
    if (maxDrawdownPct <= -1 && !events.some((e) => e.eventType === "drawdown")) events.push(event(tradeId, "drawdown", candle, low, null, { source:"backfill", timeframe, entryMode, candleTime:isoTime(candle?.time), maxDrawdownPct }));
    if (takePrice > 0 && high != null && high >= takePrice) {
      status = "take_hit";
      closedAt = isoTime(candle?.time) || new Date().toISOString();
      currentPrice = takePrice;
      resultPct = averagePrice ? (takePrice - averagePrice) / averagePrice * 100 : null;
      resultOnFullCapitalPct = resultPct == null ? null : resultPct * (usedCapitalPct / 100);
      events.push(event(tradeId, "take_hit", candle, takePrice, null, { source:"backfill", timeframe, entryMode, candleTime:isoTime(candle?.time) }));
      break;
    }
    if (status !== "averaging" && maxDrawdownPct <= -1) status = "drawdown";
  }

  if (!openedAt) return null;
  if (status !== "take_hit" && filled.length > 1) status = maxDrawdownPct <= -1 ? "drawdown" : "averaging";
  const pathState = evaluateStrategyPath({ range, levels, candles, currentPrice });
  const currentPnlPct = pathState.currentPnlPct ?? (averagePrice && currentPrice ? (currentPrice - averagePrice) / averagePrice * 100 : null);
  const finalStatus = pathState.activatedLevels > 0 ? pathState.status : status;
  const finalTakePrice = pathState.takePrice ?? takePrice;
  const finalAveragePrice = pathState.averagePrice ?? averagePrice;
  const finalUsedCapitalPct = pathState.usedCapitalPct || usedCapitalPct;
  const finalResultPct = finalStatus === "take_hit" && finalAveragePrice && finalTakePrice ? (finalTakePrice - finalAveragePrice) / finalAveragePrice * 100 : resultPct;
  const finalResultOnFullCapitalPct = finalStatus === "take_hit" && finalResultPct != null ? finalResultPct * (finalUsedCapitalPct / 100) : resultOnFullCapitalPct;
  return { status:finalStatus, openedAt, closedAt:finalStatus === "take_hit" ? closedAt : null, entryPrice:finite(levels[0]?.price), averagePrice:finalAveragePrice, takePrice:finalTakePrice, currentPrice:pathState.currentPrice ?? currentPrice, activatedLevels:pathState.activatedLevels || filled.length, usedCapitalPct:finalUsedCapitalPct, maxDrawdownPct:pathState.maxDrawdownPct ?? maxDrawdownPct, currentPnlPct, resultPct:finalResultPct, resultOnFullCapitalPct:finalResultOnFullCapitalPct, events };
}

export function replayStrategyOnCandles({ symbol, baseSymbol, exchange = "BYBIT", timeframe, entryMode, rangeDetector, candles, capital = 100 } = {}) {
  const rows = Array.isArray(candles) ? candles : [];
  const trades = [], events = [], seenRanges = new Set();
  const minLookback = Math.min(50, Math.max(5, rows.length - 1));
  for (let i = minLookback; i < rows.length; i++) {
    const history = rows.slice(0, i + 1);
    const range = normalizeDetectedRange(rangeDetector?.(history));
    if (!range?.bullish || !range.aTime || !range.bTime) continue;
    const rangeKey = `${symbol}:${timeframe}:${entryMode}:${range.aTime}:${range.bTime}`;
    if (seenRanges.has(rangeKey)) continue;
    seenRanges.add(rangeKey);
    const plan = buildStrategyPlan({ range, entryMode, currentPrice:rows[i]?.close, candles:history, capital });
    const id = backfillTradeId({ exchange, symbol, timeframe, entryMode, range });
    const replay = replayPlan({ plan, range, candles:rows, startIndex:i, tradeId:id, timeframe, entryMode });
    if (!replay) continue;
    const updatedAt = replay.closedAt || isoTime(rows.at(-1)?.time) || new Date().toISOString();
    trades.push({ id, symbol, baseSymbol:baseSymbol || String(symbol || "").replace(/USDT$/, ""), exchange, timeframe, direction:"long", entryMode, range:{ ...range, source:"backfill" }, levels:plan.levels, ...replay, updatedAt });
    events.push(...replay.events);
  }
  const takeHits = trades.filter((t) => t.status === "take_hit").length;
  const activeTrades = trades.filter((t) => ["active", "averaging"].includes(t.status)).length;
  const drawdownTrades = trades.filter((t) => t.status === "drawdown").length;
  const avg = (field) => { const vals = trades.map((t) => finite(t[field])).filter(Number.isFinite); return vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null; };
  return { trades, events, summary:{ totalTrades:trades.length, takeHits, activeTrades, drawdownTrades, avgResultPct:avg("resultPct"), avgDrawdownPct:avg("maxDrawdownPct") } };
}
