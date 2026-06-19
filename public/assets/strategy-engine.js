const ENTRY_RATIOS = Object.freeze([0.31, 0.50, 0.75, 1.00, 1.20, 1.42, 1.68, 2.00, 2.38, 2.85, 3.40, 4.10]);
const CAPITAL_MULTIPLIERS = Object.freeze({
  "0.31": [1.0, 1.0, 1.0, 6.7, 13.3, 26.7, 53.3, 106.7, 213.3, 426.7, 853.3, 1706.7],
  "0.5": [1.0, 1.0, 3.3, 6.7, 13.3, 26.7, 53.3, 106.7, 213.3, 426.7, 853.3, 1706.7],
  "0.75": [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048],
});
const START_INDEX = Object.freeze({ "0.31":0, "0.5":1, "0.75":2 });

function modeKey(entryMode) {
  const n = Number(entryMode);
  if (Math.abs(n - 0.31) < 0.0001) return "0.31";
  if (Math.abs(n - 0.5) < 0.0001) return "0.5";
  if (Math.abs(n - 0.75) < 0.0001) return "0.75";
  return "0.5";
}
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function lastPrice(candles, currentPrice) { return finite(currentPrice) ?? finite(candles?.[candles.length - 1]?.close); }
function rangeTopBottom(range) {
  const a = finite(range?.aPrice), b = finite(range?.bPrice);
  if (!(a > 0 && b > 0)) return null;
  return { top:Math.max(a, b), bottom:Math.min(a, b), bullish:range?.bullish !== false };
}
function levelPrice(range, ratio, forceLog = false) {
  const rb = rangeTopBottom(range);
  if (!rb) return null;
  const { top, bottom, bullish } = rb;
  const linear = bullish ? top - Number(ratio) * (top - bottom) : bottom + Number(ratio) * (top - bottom);
  if (!forceLog && linear > 0) return linear;
  const logSize = Math.log(top) - Math.log(bottom);
  return bullish ? Math.exp(Math.log(top) - Number(ratio) * logSize) : Math.exp(Math.log(bottom) + Number(ratio) * logSize);
}
export function getStrategyConfig(entryMode = 0.5) {
  const key = modeKey(entryMode);
  const startIndex = START_INDEX[key];
  const activeEntryRatios = ENTRY_RATIOS.slice(startIndex);
  const rawMultipliers = CAPITAL_MULTIPLIERS[key] || CAPITAL_MULTIPLIERS["0.5"];
  const qtyMultipliers = rawMultipliers.slice(0, activeEntryRatios.length);

  return {
    entryMode:Number(key),
    startIndex,
    entryRatios:activeEntryRatios,
    qtyMultipliers,
  };
}
export function calculateCapitalPlan({ entryMode = 0.5, capital = 100 } = {}) {
  const config = getStrategyConfig(entryMode);
  const total = config.qtyMultipliers.reduce((a, b) => a + b, 0);

  return config.qtyMultipliers.map((qtyMultiplier, index) => ({
    index,
    globalIndex:config.startIndex + index,
    ratio:config.entryRatios[index],
    qtyMultiplier,
    capitalPct: total > 0 ? qtyMultiplier / total * 100 : 0,
    capitalAmount:Number(capital) * (total > 0 ? qtyMultiplier / total : 0),
  }));
}
export function calculateLevels({ range, entryMode = 0.5 } = {}) {
  const config = getStrategyConfig(entryMode);
  const capitalPlan = calculateCapitalPlan({ entryMode, capital:100 });
  const forceLog = config.entryRatios.some((ratio) => { const rb = rangeTopBottom(range); if (!rb) return false; const linear = rb.bullish ? rb.top - Number(ratio) * (rb.top - rb.bottom) : rb.bottom + Number(ratio) * (rb.top - rb.bottom); return !(linear > 0); });

  return config.entryRatios.map((ratio, index) => ({
    index,
    globalIndex:config.startIndex + index,
    ratio,
    label:index === 0 ? "Вход" : `Уср. ${index}`,
    price:levelPrice(range, ratio, forceLog),
    qtyMultiplier:capitalPlan[index].qtyMultiplier,
    capitalPct:capitalPlan[index].capitalPct,
  }));
}
export function calculateAveragePrice(filledLevels = []) {
  const levels = Array.isArray(filledLevels) ? filledLevels.filter((l) => finite(l?.price) > 0 && finite(l?.qtyMultiplier) > 0) : [];
  const qty = levels.reduce((sum, l) => sum + Number(l.qtyMultiplier), 0);
  if (!(qty > 0)) return null;
  return levels.reduce((sum, l) => sum + Number(l.price) * Number(l.qtyMultiplier), 0) / qty;
}
export function calculateBc29Take({ anchorB, extremeC, direction = "long" } = {}) {
  const B = Number(anchorB);
  const C = Number(extremeC);
  if (!Number.isFinite(B) || B <= 0 || !Number.isFinite(C) || C <= 0) return null;
  if (direction === "long") {
    if (!(C < B)) return null;
    return C + 0.29 * (B - C);
  }
  if (!(C > B)) return null;
  return C - 0.29 * (C - B);
}

function fixedTakeForRange(range) {
  const rb = rangeTopBottom(range);
  if (!rb) return null;
  const size = rb.top - rb.bottom;
  return rb.bullish ? rb.top - 0.08 * size : rb.bottom + 0.08 * size;
}

export function calculateDynamicTake({ range, filledLevels = [], candles = [], currentIndex, previousExtremeC, previousTakePrice, averagePrice, direction = "long" } = {}) {
  const activated = Array.isArray(filledLevels) ? filledLevels : [];
  const deepestRatio = activated.reduce((maximum, level) => Math.max(maximum, Number(level?.ratio) || 0), 0);
  const A = Number(range?.aPrice);
  const B = Number(range?.bPrice);
  if (!(A > 0) || !(B > 0)) return { takePrice:null, dynamicTakeMode:false, anchorB:null, extremeC:null };
  if (deepestRatio < 1 - 1e-9) return { takePrice:fixedTakeForRange(range), dynamicTakeMode:false, anchorB:B, extremeC:null };

  let extremeC = Number(previousExtremeC);
  if (!Number.isFinite(extremeC) || extremeC <= 0) {
    extremeC = findLongExtremeAfterB({ range, candles, endIndex:currentIndex });
  }
  const candidate = calculateBc29Take({ anchorB:B, extremeC, direction });
  const average = Number(averagePrice);
  const previousTake = Number(previousTakePrice);
  const tolerance = Math.max(Math.abs(average || 0) * 1e-9, 1e-12);
  const validCandidate = Number.isFinite(candidate) && candidate > 0 && (!(average > 0) || candidate > average + tolerance);
  return {
    takePrice:validCandidate ? candidate : (Number.isFinite(previousTake) && previousTake > average + tolerance ? previousTake : null),
    dynamicTakeMode:true,
    anchorB:B,
    extremeC,
  };
}

function candleTimeValue(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : value;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n < 1e12 ? n * 1000 : n;
}
function buildLevelStates({ levels = [], filledCount = 0, candles = [], bIndex = -1, currentPrice } = {}) {
  const current = finite(currentPrice);
  return (Array.isArray(levels) ? levels : []).map((level, index) => {
    const price = finite(level?.price);
    let executedAt = null;
    if (price > 0 && bIndex >= 0) {
      for (let i = bIndex + 1; i < candles.length; i += 1) {
        const low = finite(candles[i]?.low);
        if (low != null && low <= price) {
          executedAt = candles[i]?.time ?? null;
          break;
        }
      }
    }
    const executed = Boolean(executedAt) || index < Number(filledCount || 0);
    let distancePct = null;
    if (!executed && current > 0 && price > 0) distancePct = Math.abs((current - price) / current * 100);
    const state = executed ? "executed" : (distancePct != null && distancePct <= 1 ? "near" : "waiting");
    return {
      index,
      label:level?.label || (index === 0 ? "Вход" : `Уср. ${index}`),
      price:level?.price,
      state,
      executed,
      executedAt,
      distancePct,
    };
  });
}

function findRangeBIndex(range, candles = []) {
  if (!Array.isArray(candles) || !candles.length || range?.bTime == null) return -1;
  const target = candleTimeValue(range.bTime);
  let fallback = -1;
  for (let i = 0; i < candles.length; i += 1) {
    const value = candleTimeValue(candles[i]?.time);
    if (value == null || target == null) continue;
    if (value === target || String(candles[i]?.time) === String(range.bTime)) return i;
    if (typeof value === "number" && typeof target === "number" && value <= target) fallback = i;
  }
  return fallback;
}
function findLongExtremeAfterB({ range, candles = [], endIndex } = {}) {
  const bIndex = findRangeBIndex(range, candles);
  if (bIndex < 0) return null;
  let minimum = null;
  const lastIndex = Number.isInteger(endIndex) ? Math.min(endIndex, candles.length - 1) : candles.length - 1;
  for (let index = bIndex; index <= lastIndex; index += 1) {
    const low = Number(candles[index]?.low);
    if (Number.isFinite(low) && low > 0) minimum = minimum == null ? low : Math.min(minimum, low);
  }
  return minimum;
}

export function evaluateStrategyPath({ range, levels, candles, currentPrice, capital = 100 } = {}) {
  const rows = Array.isArray(candles) ? candles : [];
  const activeLevels = Array.isArray(levels) ? levels : calculateLevels({ range });
  const current = lastPrice(rows, currentPrice);
  const bIndex = findRangeBIndex(range, rows);
  if (bIndex < 0 || bIndex >= rows.length - 1) return { pathFound:false, status:"waiting_entry", currentPrice:current, activatedLevels:0, averagePrice:null, usedCapitalPct:0, takePrice:null, dynamicTakeMode:false, currentPnlPct:null, maxDrawdownPct:0, levelStates:buildLevelStates({ levels:activeLevels, filledCount:0, candles:rows, bIndex, currentPrice:current }) };

  const filled = [];
  let averagePrice = null;
  let usedCapitalPct = 0;
  let dynamicTakeMode = false;
  let dynamicAnchorB = finite(range?.bPrice);
  let dynamicExtremeC = null;
  let takePrice = fixedTakeForRange(range);
  let takeActivatedAfterIndex = null;
  let currentPnlPct = null;
  let maxDrawdownPct = 0;
  let status = "waiting_entry";
  let lastSeenPrice = current;
  let openedAt = null;
  let closedAt = null;
  let closePrice = null;
  let realizedResultPct = null;
  let resultOnFullCapitalPct = null;

  for (let i = bIndex + 1; i < rows.length; i += 1) {
    const candle = rows[i];
    const low = finite(candle?.low);
    const high = finite(candle?.high);
    const close = finite(candle?.close) ?? high ?? low;
    if (close != null) lastSeenPrice = close;

    for (let levelIndex = filled.length; levelIndex < activeLevels.length; levelIndex += 1) {
      const level = activeLevels[levelIndex];
      const levelValue = finite(level?.price);
      if (levelValue > 0 && low != null && low <= levelValue) {
        filled.push(level);
        if (!openedAt) openedAt = candle?.time ?? null;
        averagePrice = calculateAveragePrice(filled);
        usedCapitalPct = filled.reduce((sum, l) => sum + (finite(l?.capitalPct) || 0), 0);
        const take = calculateDynamicTake({ range, filledLevels:filled, candles:rows, currentIndex:i, previousExtremeC:dynamicExtremeC, previousTakePrice:takePrice, averagePrice });
        const changedTake = take.dynamicTakeMode && take.takePrice > 0 && (!(takePrice > 0) || take.takePrice < takePrice - 1e-12);
        takePrice = take.takePrice;
        dynamicTakeMode = take.dynamicTakeMode;
        dynamicAnchorB = take.anchorB ?? dynamicAnchorB;
        dynamicExtremeC = take.extremeC ?? dynamicExtremeC;
        if (changedTake) takeActivatedAfterIndex = i;
        status = filled.length > 1 ? "averaging" : "active";
      } else {
        break;
      }
    }

    if (!filled.length) continue;
    if (dynamicTakeMode) {
      const candleLow = Number(low);
      if (candleLow > 0 && (dynamicExtremeC == null || candleLow < dynamicExtremeC)) {
        const take = calculateDynamicTake({ range, filledLevels:filled, candles:rows, currentIndex:i, previousExtremeC:candleLow, previousTakePrice:takePrice, averagePrice });
        if (take.takePrice > 0 && (!(takePrice > 0) || take.takePrice < takePrice - 1e-12)) takeActivatedAfterIndex = i;
        dynamicExtremeC = candleLow;
        takePrice = take.takePrice;
        dynamicAnchorB = take.anchorB ?? dynamicAnchorB;
      }
    }
    if (averagePrice && low != null) maxDrawdownPct = Math.min(maxDrawdownPct, (low - averagePrice) / averagePrice * 100);
    const executableTake = dynamicTakeMode && takeActivatedAfterIndex === i ? null : takePrice;
    if (executableTake > 0 && high != null && high >= executableTake) {
      status = "take_hit";
      closePrice = executableTake;
      closedAt = candle?.time ?? null;
      realizedResultPct = averagePrice > 0 ? ((executableTake - averagePrice) / averagePrice) * 100 : null;
      resultOnFullCapitalPct = Number.isFinite(realizedResultPct) ? realizedResultPct * (usedCapitalPct / 100) : null;
      break;
    }
    if (maxDrawdownPct < 0 && close != null && averagePrice && close < averagePrice) status = "drawdown";
  }

  const marketPrice = current ?? lastSeenPrice;
  const effectivePrice = status === "take_hit" && Number.isFinite(closePrice) ? closePrice : marketPrice;
  currentPnlPct = averagePrice && effectivePrice ? (effectivePrice - averagePrice) / averagePrice * 100 : null;
  if (status !== "take_hit" && filled.length > 1 && status !== "drawdown") status = "averaging";
  return { pathFound:true, status, currentPrice:effectivePrice, marketPrice, openedAt, closedAt, closePrice, activatedLevels:filled.length, averagePrice, usedCapitalPct, takePrice, dynamicTakeMode, dynamicAnchorB, dynamicExtremeC, currentPnlPct, realizedResultPct, resultPct:status === "take_hit" ? realizedResultPct : null, resultOnFullCapitalPct, maxDrawdownPct, capital, levelStates:buildLevelStates({ levels:activeLevels, filledCount:filled.length, candles:rows, bIndex, currentPrice:effectivePrice }) };
}

export function buildStrategyPlan({ range, entryMode = 0.5, currentPrice, candles, capital = 100 } = {}) {
  const price = lastPrice(candles, currentPrice);
  const levels = calculateLevels({ range, entryMode });
  const capitalPlan = calculateCapitalPlan({ entryMode, capital });
  const pathState = evaluateStrategyPath({ range, levels, candles, currentPrice:price, capital });
  if (pathState.pathFound && pathState.activatedLevels > 0) {
    return { entryMode:getStrategyConfig(entryMode).entryMode, direction:"long", currentPrice:pathState.currentPrice ?? price, marketPrice:pathState.marketPrice, openedAt:pathState.openedAt, closedAt:pathState.closedAt, closePrice:pathState.closePrice, levels:levels.map((level, index) => ({ ...level, state:pathState.levelStates?.[index]?.state || "waiting" })), levelStates:pathState.levelStates || [], activatedLevels:pathState.activatedLevels, averagePrice:pathState.averagePrice, usedCapitalPct:pathState.usedCapitalPct, takePrice:pathState.takePrice, dynamicTakeMode:pathState.dynamicTakeMode, dynamicAnchorB:pathState.dynamicAnchorB, dynamicExtremeC:pathState.dynamicExtremeC, currentPnlPct:pathState.currentPnlPct, realizedResultPct:pathState.realizedResultPct, resultPct:pathState.resultPct, resultOnFullCapitalPct:pathState.resultOnFullCapitalPct, maxDrawdownPct:pathState.maxDrawdownPct, status:pathState.status, pathBased:true, capitalPlan };
  }
  const side = rangeTopBottom(range)?.bullish !== false ? "long" : "short";
  const activated = levels.filter((l) => price != null && side === "long" && price <= Number(l.price));
  const avg = calculateAveragePrice(activated);
  const take = calculateDynamicTake({ range, filledLevels:activated, candles, currentIndex:Array.isArray(candles) ? candles.length - 1 : undefined, averagePrice:avg });
  const currentPnlPct = avg && price ? (price - avg) / avg * 100 : null;
  const status = activated.length > 1 ? (currentPnlPct < 0 ? "drawdown" : "averaging") : activated.length === 1 ? (currentPnlPct < 0 ? "drawdown" : "active") : "waiting_entry";
  const bIndex = findRangeBIndex(range, Array.isArray(candles) ? candles : []);
  const levelStates = buildLevelStates({ levels, filledCount:activated.length, candles:Array.isArray(candles) ? candles : [], bIndex, currentPrice:price });
  return { entryMode:getStrategyConfig(entryMode).entryMode, direction:"long", currentPrice:price, levels:levels.map((level, index) => ({ ...level, state:levelStates[index]?.state || "waiting" })), levelStates, activatedLevels:activated.length, averagePrice:avg, usedCapitalPct:activated.reduce((s, l) => s + l.capitalPct, 0), takePrice:take.takePrice, dynamicTakeMode:take.dynamicTakeMode, dynamicAnchorB:take.anchorB, dynamicExtremeC:take.extremeC, currentPnlPct, maxDrawdownPct:currentPnlPct == null ? 0 : Math.min(0, currentPnlPct), status, pathBased:false, capitalPlan };
}
export function evaluateVirtualTrade({ trade, candles, currentPrice } = {}) {
  if (trade?.status === "take_hit") {
    const averagePrice = finite(trade.averagePrice) ?? finite(trade.entryPrice);
    const takePrice = finite(trade.takePrice);
    const resultPct = averagePrice > 0 && takePrice > 0 ? ((takePrice - averagePrice) / averagePrice) * 100 : finite(trade.resultPct);
    const usedCapitalPct = finite(trade.usedCapitalPct) ?? 0;
    return {
      ...trade,
      status:"take_hit",
      currentPrice:takePrice,
      currentPnlPct:resultPct,
      resultPct,
      resultOnFullCapitalPct:Number.isFinite(resultPct) ? resultPct * (usedCapitalPct / 100) : finite(trade.resultOnFullCapitalPct),
    };
  }

  const price = lastPrice(candles, currentPrice) ?? finite(trade?.currentPrice);
  const levels = Array.isArray(trade?.levels) ? trade.levels : [];
  const filled = levels.filter((l) => price != null && price <= Number(l.price));
  const hadEntry = ["active", "averaging", "drawdown", "take_hit"].includes(trade?.status) || Number(trade?.activatedLevels) > 0;
  const activated = hadEntry && filled.length === 0 ? levels.slice(0, Math.max(1, Number(trade?.activatedLevels) || 1)) : filled;
  const averagePrice = calculateAveragePrice(activated) ?? finite(trade?.averagePrice);
  const storedExtremeC = finite(trade?.dynamicExtremeC) ?? finite(trade?.range?.dynamicExtremeC);
  const storedTakePrice = finite(trade?.takePrice);
  const take = calculateDynamicTake({ range:trade?.range, filledLevels:activated, candles, currentIndex:Array.isArray(candles) ? candles.length - 1 : undefined, previousExtremeC:storedExtremeC, previousTakePrice:storedTakePrice, averagePrice });
  const takePrice = take.takePrice ?? storedTakePrice;
  const currentPnlPct = averagePrice && price ? (price - averagePrice) / averagePrice * 100 : null;
  const drawdown = currentPnlPct == null ? finite(trade?.maxDrawdownPct) ?? 0 : Math.min(finite(trade?.maxDrawdownPct) ?? 0, currentPnlPct);
  let status = trade?.status || "waiting_entry";
  if (!hadEntry && activated.length) status = "active";
  if ((hadEntry || activated.length) && activated.length > 1) status = "averaging";
  if ((hadEntry || activated.length) && currentPnlPct < 0) status = "drawdown";
  const rows = Array.isArray(candles) ? candles : [];
  const latestHigh = rows.length ? finite(rows[rows.length - 1]?.high) : null;
  const touchPrice = latestHigh ?? price;
  const canCloseAtTake = !take.dynamicTakeMode || (takePrice > 0 && averagePrice > 0 && takePrice > averagePrice);
  const takeHit = (hadEntry || activated.length) && canCloseAtTake && takePrice && touchPrice >= takePrice;
  if (takeHit) status = "take_hit";
  const realizedResultPct = takeHit && averagePrice > 0 && takePrice > 0 ? ((takePrice - averagePrice) / averagePrice) * 100 : null;
  const finalUsedCapitalPct = activated.reduce((sum, level) => sum + (Number(level.capitalPct) || 0), 0) || Number(trade?.usedCapitalPct) || 0;
  return {
    ...trade,
    status,
    currentPrice:takeHit ? takePrice : price,
    activatedLevels:activated.length || Number(trade?.activatedLevels) || 0,
    averagePrice,
    takePrice,
    dynamicTakeMode:take.dynamicTakeMode,
    dynamicAnchorB:take.anchorB ?? finite(trade?.dynamicAnchorB) ?? finite(trade?.range?.dynamicAnchorB) ?? null,
    dynamicExtremeC:take.extremeC ?? storedExtremeC ?? null,
    usedCapitalPct:finalUsedCapitalPct,
    currentPnlPct:takeHit ? realizedResultPct : currentPnlPct,
    maxDrawdownPct:drawdown,
    resultPct:takeHit ? realizedResultPct : trade?.resultPct ?? null,
    resultOnFullCapitalPct:takeHit && Number.isFinite(realizedResultPct) ? realizedResultPct * (finalUsedCapitalPct / 100) : trade?.resultOnFullCapitalPct ?? null,
  };
}

if (typeof window !== "undefined") {
  window.StrategyEngine = {
    getStrategyConfig,
    calculateCapitalPlan,
    calculateLevels,
    buildStrategyPlan,
    evaluateStrategyPath,
  };
}
