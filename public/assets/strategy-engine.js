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
  return { entryMode:Number(key), entryRatios:[...ENTRY_RATIOS], qtyMultipliers:[...CAPITAL_MULTIPLIERS[key]], startIndex:START_INDEX[key] };
}
export function calculateCapitalPlan({ entryMode = 0.5, capital = 100 } = {}) {
  const config = getStrategyConfig(entryMode);
  const total = config.qtyMultipliers.reduce((a, b) => a + b, 0);
  return config.qtyMultipliers.map((qtyMultiplier, index) => ({ index, qtyMultiplier, capitalPct: total > 0 ? qtyMultiplier / total * 100 : 0, capitalAmount:Number(capital) * (total > 0 ? qtyMultiplier / total : 0) }));
}
export function calculateLevels({ range, entryMode = 0.5 } = {}) {
  const config = getStrategyConfig(entryMode);
  const capitalPlan = calculateCapitalPlan({ entryMode, capital:100 });
  const forceLog = config.entryRatios.some((ratio) => { const rb = rangeTopBottom(range); if (!rb) return false; const linear = rb.bullish ? rb.top - Number(ratio) * (rb.top - rb.bottom) : rb.bottom + Number(ratio) * (rb.top - rb.bottom); return !(linear > 0); });
  return config.entryRatios.map((ratio, index) => ({ index, ratio, price:levelPrice(range, ratio, forceLog), qtyMultiplier:capitalPlan[index].qtyMultiplier, capitalPct:capitalPlan[index].capitalPct }));
}
export function calculateAveragePrice(filledLevels = []) {
  const levels = Array.isArray(filledLevels) ? filledLevels.filter((l) => finite(l?.price) > 0 && finite(l?.qtyMultiplier) > 0) : [];
  const qty = levels.reduce((sum, l) => sum + Number(l.qtyMultiplier), 0);
  if (!(qty > 0)) return null;
  return levels.reduce((sum, l) => sum + Number(l.price) * Number(l.qtyMultiplier), 0) / qty;
}
export function calculateDynamicTake({ range, filledLevels = [], candles, currentPrice } = {}) {
  const activated = Array.isArray(filledLevels) ? filledLevels : [];
  const deepest = activated.reduce((m, l) => Math.max(m, Number(l?.ratio) || 0), 0);
  const rb = rangeTopBottom(range);
  if (!rb) return { takePrice:null, dynamicTakeMode:false };
  if (deepest < 1) {
    const size = rb.top - rb.bottom;
    return { takePrice: rb.bullish ? rb.top - 0.08 * size : rb.bottom + 0.08 * size, dynamicTakeMode:false };
  }
  const price = lastPrice(candles, currentPrice);
  const avg = calculateAveragePrice(activated) ?? price;
  if (!(price > 0 && avg > 0)) return { takePrice:null, dynamicTakeMode:true };
  return { takePrice: price + (avg - price) * 0.29, dynamicTakeMode:true };
}
export function buildStrategyPlan({ range, entryMode = 0.5, currentPrice, candles, capital = 100 } = {}) {
  const price = lastPrice(candles, currentPrice);
  const levels = calculateLevels({ range, entryMode });
  const start = getStrategyConfig(entryMode).startIndex;
  const side = rangeTopBottom(range)?.bullish !== false ? "long" : "short";
  const activated = levels.filter((l) => l.index >= start && price != null && side === "long" && price <= l.price);
  const avg = calculateAveragePrice(activated);
  const take = calculateDynamicTake({ range, filledLevels:activated, candles, currentPrice:price });
  return { entryMode:getStrategyConfig(entryMode).entryMode, direction:"long", currentPrice:price, levels, activatedLevels:activated.length, averagePrice:avg, usedCapitalPct:activated.reduce((s, l) => s + l.capitalPct, 0), takePrice:take.takePrice, dynamicTakeMode:take.dynamicTakeMode, capitalPlan:calculateCapitalPlan({ entryMode, capital }) };
}
export function evaluateVirtualTrade({ trade, candles, currentPrice } = {}) {
  const price = lastPrice(candles, currentPrice) ?? finite(trade?.currentPrice);
  const levels = Array.isArray(trade?.levels) ? trade.levels : [];
  const entryMode = trade?.entryMode ?? 0.5;
  const start = getStrategyConfig(entryMode).startIndex;
  const filled = levels.filter((l) => l.index >= start && price != null && price <= Number(l.price));
  const hadEntry = ["active", "averaging", "drawdown", "take_hit"].includes(trade?.status) || Number(trade?.activatedLevels) > 0;
  const activated = hadEntry && filled.length === 0 ? levels.slice(start, start + Math.max(1, Number(trade?.activatedLevels) || 1)) : filled;
  const averagePrice = calculateAveragePrice(activated) ?? finite(trade?.averagePrice);
  const take = calculateDynamicTake({ range:trade?.range, filledLevels:activated, candles, currentPrice:price });
  const takePrice = take.takePrice ?? finite(trade?.takePrice);
  const currentPnlPct = averagePrice && price ? (price - averagePrice) / averagePrice * 100 : null;
  const drawdown = currentPnlPct == null ? finite(trade?.maxDrawdownPct) ?? 0 : Math.min(finite(trade?.maxDrawdownPct) ?? 0, currentPnlPct);
  let status = trade?.status || "waiting_entry";
  if (!hadEntry && activated.length) status = "active";
  if ((hadEntry || activated.length) && activated.length > 1) status = "averaging";
  if ((hadEntry || activated.length) && currentPnlPct < 0) status = "drawdown";
  if ((hadEntry || activated.length) && takePrice && price >= takePrice) status = "take_hit";
  return { ...trade, status, currentPrice:price, activatedLevels:activated.length || Number(trade?.activatedLevels) || 0, averagePrice, takePrice, dynamicTakeMode:take.dynamicTakeMode, usedCapitalPct:activated.reduce((s, l) => s + (Number(l.capitalPct) || 0), 0) || trade?.usedCapitalPct || 0, currentPnlPct, maxDrawdownPct:drawdown, resultPct:status === "take_hit" ? currentPnlPct : trade?.resultPct ?? null, resultOnFullCapitalPct:status === "take_hit" ? currentPnlPct * ((activated.reduce((s,l)=>s+(Number(l.capitalPct)||0),0))/100) : trade?.resultOnFullCapitalPct ?? null };
}
