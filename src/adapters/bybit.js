const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];
const BYBIT_INTERVAL = { "1m": "1", "3m": "3", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D", "1w": "W" };
const RANGE_PARAMS = { correctionPct: 0.3, maxRects: 20, minBars: 7 };

function parseBybitKlineRow(row) {
  if (!Array.isArray(row) || row.length < 5) return null;
  const time = Number(row[0]);
  const open = Number(row[1]);
  const high = Number(row[2]);
  const low = Number(row[3]);
  const close = Number(row[4]);
  if (![time, open, high, low, close].every(Number.isFinite)) return null;
  return { time, open, high, low, close };
}

function lastValidRange(ranges) {
  if (!Array.isArray(ranges) || ranges.length === 0) return null;
  return ranges[ranges.length - 1] || null;
}

export function detectRangesWithPreview(candles = [], correctionPct = 0.3, maxRects = 20, minBars = 7) {
  if (!Array.isArray(candles) || candles.length < minBars) return { ranges: [], previewRange: null };

  const ranges = [];
  let active = null;

  for (let i = 2; i < candles.length; i += 1) {
    const a = candles[i - 2];
    const b = candles[i - 1];
    const c = candles[i];
    if (!a || !b || !c) continue;

    if (!active) {
      const impulseUp = c.high > b.high && b.high > a.high && c.low >= a.low;
      const impulseDown = c.low < b.low && b.low < a.low && c.high <= a.high;
      if (!impulseUp && !impulseDown) continue;

      const bullish = impulseUp;
      const low = Math.min(a.low, b.low, c.low);
      const high = Math.max(a.high, b.high, c.high);

      active = {
        startIndex: i - 2,
        endIndex: i,
        low,
        high,
        bullish,
        correctionSeen: false,
      };
      continue;
    }

    const prevHigh = active.high;
    const prevLow = active.low;
    active.endIndex = i;
    active.high = Math.max(active.high, c.high);
    active.low = Math.min(active.low, c.low);

    const span = active.high - active.low;
    if (span <= 0) continue;

    if (active.bullish) {
      const correctionDepth = (active.high - c.low) / span;
      if (correctionDepth >= correctionPct) active.correctionSeen = true;
      if (c.close < prevLow) {
        active = null;
      }
    } else {
      const correctionDepth = (c.high - active.low) / span;
      if (correctionDepth >= correctionPct) active.correctionSeen = true;
      if (c.close > prevHigh) {
        active = null;
      }
    }

    if (!active) continue;

    const length = active.endIndex - active.startIndex + 1;
    if (length >= minBars && active.correctionSeen) {
      const rangeItem = [
        active.startIndex,
        active.endIndex,
        active.low,
        active.high,
        active.bullish,
      ];
      ranges.push(rangeItem);
      if (ranges.length > maxRects) ranges.shift();
      active.correctionSeen = false;
      active.startIndex = active.endIndex - 1;
      active.low = Math.min(b.low, c.low);
      active.high = Math.max(b.high, c.high);
    }
  }

  return { ranges, previewRange: lastValidRange(ranges) };
}

async function fetchBybitCandles(symbol, timeframe) {
  const interval = BYBIT_INTERVAL[timeframe];
  if (!interval) return [];
  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=400`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bybit kline HTTP ${res.status}`);
  const json = await res.json();
  const list = Array.isArray(json?.result?.list) ? json.result.list : [];
  return list.map(parseBybitKlineRow).filter(Boolean).sort((a, b) => a.time - b.time);
}

function stateFromPreview(previewRange) {
  if (!Array.isArray(previewRange) || typeof previewRange[4] !== "boolean") return "neutral";
  return previewRange[4] ? "bullish" : "bearish";
}

function summarizeGroup(states) {
  const score = states.reduce((acc, state) => {
    if (state === "bullish") return acc + 1;
    if (state === "bearish") return acc - 1;
    return acc;
  }, 0);
  if (score >= 2) return "Преобладает bullish-смещение по активным диапазонам.";
  if (score <= -2) return "Преобладает bearish-смещение по активным диапазонам.";
  return "Сигналы смешанные: активные диапазоны без явного перекоса.";
}

export async function getTechnicalBias(bybitSymbol) {
  const symbol = String(bybitSymbol || "").toUpperCase();
  const timeframes = Object.fromEntries(TIMEFRAMES.map((tf) => [tf, "neutral"]));

  if (!symbol) {
    return {
      source: "Bybit spot",
      updated_at: new Date().toISOString(),
      symbol: null,
      timeframes,
      notes: {
        lower_tf: "Символ проекта не задан, применен neutral fallback.",
        mid_tf: "Символ проекта не задан, применен neutral fallback.",
        higher_tf: "Символ проекта не задан, применен neutral fallback.",
      },
    };
  }

  await Promise.all(TIMEFRAMES.map(async (tf) => {
    try {
      const candles = await fetchBybitCandles(symbol, tf);
      const { previewRange } = detectRangesWithPreview(
        candles,
        RANGE_PARAMS.correctionPct,
        RANGE_PARAMS.maxRects,
        RANGE_PARAMS.minBars
      );
      timeframes[tf] = stateFromPreview(previewRange);
    } catch {
      timeframes[tf] = "neutral";
    }
  }));

  return {
    source: "Bybit spot",
    updated_at: new Date().toISOString(),
    symbol,
    timeframes,
    notes: {
      lower_tf: summarizeGroup([timeframes["1m"], timeframes["3m"], timeframes["5m"]]),
      mid_tf: summarizeGroup([timeframes["15m"], timeframes["1h"], timeframes["4h"]]),
      higher_tf: summarizeGroup([timeframes["1d"], timeframes["1w"]]),
    },
  };
}
