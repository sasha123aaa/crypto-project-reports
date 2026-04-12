const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];

const BYBIT_INTERVAL = {
  "1m": "1",
  "3m": "3",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
};

const RANGE_PARAMS = {
  correctionPct: 0.3,
  maxRects: 20,
  minBars: 7,
};

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

function distanceToRange(price, low, high) {
  if (![price, low, high].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  if (price >= low && price <= high) return 0;
  return Math.min(Math.abs(price - low), Math.abs(price - high));
}

function nearestRangeToPrice(ranges, price) {
  if (!Array.isArray(ranges) || !ranges.length || !Number.isFinite(price)) return null;

  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (const range of ranges) {
    if (!Array.isArray(range) || range.length < 5) continue;
    const low = Number(range[2]);
    const high = Number(range[3]);
    const dist = distanceToRange(price, Math.min(low, high), Math.max(low, high));
    if (dist < bestDist) {
      bestDist = dist;
      best = range;
    }
  }

  return best;
}

// Точная копия логики из оригинального HTML с минимальной адаптацией под модуль.
export function detectRangesWithPreview(candles, correctionPct = 0.3, maxRects = 20, minBars = 7) {
  let ranges = [];
  let previewRange = null;
  let isUp = null;
  let currA = null, currB = null, currC = null;
  let currA_i = null, currB_i = null, currC_i = null;
  let b_fixed_at = null;
  let need_correction = false;
  let in_expand_mode = false;
  let expandA = null, expandB = null;
  let expandA_i = null, expandB_i = null;
  let expand_len = 0;
  let prev_fixed_on_expand = false;
  let override_A_i = null;

  if (!Array.isArray(candles) || candles.length < minBars) {
    return { ranges: [], previewRange: null };
  }

  function appendOrReplaceCurrent() {
    if (currA_i === null || currB_i === null) return;

    const bypassMinbars = (override_A_i !== null && currA_i === override_A_i);
    if (!bypassMinbars && ((currB_i - currA_i + 1) < minBars)) {
      return;
    }

    const item = [currA_i, currB_i, currA, currB, isUp];
    if (ranges.length && ranges[ranges.length - 1][0] === currA_i) {
      ranges[ranges.length - 1] = item;
    } else {
      ranges.push(item);
    }

    if (ranges.length > maxRects) {
      ranges = ranges.slice(ranges.length - maxRects);
    }

    if (bypassMinbars) {
      override_A_i = null;
    }
  }

  const len = candles.length;

  for (let i = 2; i < len; i++) {
    const high = candles[i].high;
    const low = candles[i].low;

    if (isUp === null) {
      if (candles[i - 1].low < candles[i - 2].low) {
        isUp = true;
        currA = candles[i - 1].low;
        currA_i = i - 1;
      } else if (candles[i - 1].high > candles[i - 2].high) {
        isUp = false;
        currA = candles[i - 1].high;
        currA_i = i - 1;
      }
      continue;
    }

    if (isUp) {
      if (currB === null && candles[i - 1].high > currA) {
        currB = candles[i - 1].high;
        currB_i = i - 1;
        b_fixed_at = i - 1;
      } else if (currB !== null && !need_correction && !in_expand_mode) {
        if (candles[i - 1].high > currB) {
          currB = candles[i - 1].high;
          currB_i = i - 1;
          b_fixed_at = i - 1;
        } else if (i > b_fixed_at) {
          const corrLevel = currB - (currB - currA) * correctionPct;
          if (low <= corrLevel) {
            currC = low;
            currC_i = i;
            need_correction = true;
          }
        }
      } else if (need_correction) {
        if (low < currC) {
          currC = low;
          currC_i = i;
        }

        if (low < currA) {
          let peak_i = currA_i;
          let peak = candles[currA_i].high;
          for (let j = currA_i; j <= i - 1; j++) {
            if (candles[j].high > peak) {
              peak = candles[j].high;
              peak_i = j;
            }
          }

          currB = peak;
          currB_i = peak_i;
          appendOrReplaceCurrent();

          isUp = false;
          currA = currB;
          currA_i = currB_i;
          currB = null;
          currC = null;
          currB_i = null;
          currC_i = null;
          need_correction = false;
          b_fixed_at = null;
          in_expand_mode = false;
          prev_fixed_on_expand = false;
          override_A_i = currA_i;
          continue;
        }

        if (!in_expand_mode && candles[i - 1].high > currB) {
          appendOrReplaceCurrent();
          prev_fixed_on_expand = true;

          const subStart = currB_i + 1;
          const subEnd = i - 1;
          if (subEnd >= subStart) {
            let minLow = candles[subStart].low;
            let minLow_i = subStart;
            for (let j = subStart; j <= subEnd; j++) {
              if (candles[j].low < minLow) {
                minLow = candles[j].low;
                minLow_i = j;
              }
            }

            expandA_i = minLow_i;
            expandA = candles[expandA_i].low;
            expandB = candles[i - 1].high;
            expandB_i = i - 1;
            expand_len = expandB_i - expandA_i + 1;
            in_expand_mode = true;
          }
        } else if (in_expand_mode) {
          if (candles[i - 1].high > expandB) {
            expandB = candles[i - 1].high;
            expandB_i = i - 1;
          }

          expand_len = expandB_i - expandA_i + 1;

          if (expand_len < minBars) {
            if (low < expandA) {
              if (!prev_fixed_on_expand) {
                appendOrReplaceCurrent();
              }

              if (ranges.length && ranges[ranges.length - 1][4] === isUp) {
                const last = ranges[ranges.length - 1];
                const a_i = last[0];
                const a_p = last[2];
                const d = last[4];
                ranges[ranges.length - 1] = [a_i, expandB_i, a_p, expandB, d];
              }

              currB = expandB;
              currB_i = expandB_i;
              in_expand_mode = false;
              prev_fixed_on_expand = false;
            }
            continue;
          }

          const corrLevelNext = expandB - (expandB - expandA) * correctionPct;
          if (low <= corrLevelNext) {
            if (!prev_fixed_on_expand) {
              appendOrReplaceCurrent();
            }

            currA = expandA;
            currA_i = expandA_i;
            currB = expandB;
            currB_i = expandB_i;
            currC = low;
            currC_i = i;
            need_correction = true;
            in_expand_mode = false;
            prev_fixed_on_expand = false;
          }
        }
      }
    } else {
      if (currB === null && candles[i - 1].low < currA) {
        currB = candles[i - 1].low;
        currB_i = i - 1;
        b_fixed_at = i - 1;
      } else if (currB !== null && !need_correction && !in_expand_mode) {
        if (candles[i - 1].low < currB) {
          currB = candles[i - 1].low;
          currB_i = i - 1;
          b_fixed_at = i - 1;
        } else if (i > b_fixed_at) {
          const corrLevel = currB + (currA - currB) * correctionPct;
          if (high >= corrLevel) {
            currC = high;
            currC_i = i;
            need_correction = true;
          }
        }
      } else if (need_correction) {
        if (high > currC) {
          currC = high;
          currC_i = i;
        }

        if (high > currA) {
          let trough_i = currA_i;
          let trough = candles[currA_i].low;
          for (let j = currA_i; j <= i - 1; j++) {
            if (candles[j].low < trough) {
              trough = candles[j].low;
              trough_i = j;
            }
          }

          currB = trough;
          currB_i = trough_i;
          appendOrReplaceCurrent();

          isUp = true;
          currA = currB;
          currA_i = currB_i;
          currB = null;
          currC = null;
          currB_i = null;
          currC_i = null;
          need_correction = false;
          b_fixed_at = null;
          in_expand_mode = false;
          prev_fixed_on_expand = false;
          override_A_i = currA_i;
          continue;
        }

        if (!in_expand_mode && candles[i - 1].low < currB) {
          appendOrReplaceCurrent();
          prev_fixed_on_expand = true;

          const subStart = currB_i + 1;
          const subEnd = i - 1;
          if (subEnd >= subStart) {
            let maxHigh = candles[subStart].high;
            let maxHigh_i = subStart;
            for (let j = subStart; j <= subEnd; j++) {
              if (candles[j].high > maxHigh) {
                maxHigh = candles[j].high;
                maxHigh_i = j;
              }
            }

            expandA_i = maxHigh_i;
            expandA = candles[expandA_i].high;
            expandB = candles[i - 1].low;
            expandB_i = i - 1;
            expand_len = expandB_i - expandA_i + 1;
            in_expand_mode = true;
          }
        } else if (in_expand_mode) {
          if (candles[i - 1].low < expandB) {
            expandB = candles[i - 1].low;
            expandB_i = i - 1;
          }

          expand_len = expandB_i - expandA_i + 1;

          if (expand_len < minBars) {
            if (high > expandA) {
              if (!prev_fixed_on_expand) {
                appendOrReplaceCurrent();
              }

              if (ranges.length && ranges[ranges.length - 1][4] === isUp) {
                const last = ranges[ranges.length - 1];
                const a_i = last[0];
                const a_p = last[2];
                const d = last[4];
                ranges[ranges.length - 1] = [a_i, expandB_i, a_p, expandB, d];
              }

              currB = expandB;
              currB_i = expandB_i;
              in_expand_mode = false;
              prev_fixed_on_expand = false;
            }
            continue;
          }

          const corrLevelNext = expandB + (expandA - expandB) * correctionPct;
          if (high >= corrLevelNext) {
            if (!prev_fixed_on_expand) {
              appendOrReplaceCurrent();
            }

            currA = expandA;
            currA_i = expandA_i;
            currB = expandB;
            currB_i = expandB_i;
            currC = high;
            currC_i = i;
            need_correction = true;
            in_expand_mode = false;
            prev_fixed_on_expand = false;
          }
        }
      }
    }
  }

  if (in_expand_mode && expandA_i !== null) {
    const lastIdx = len - 1;
    if (isUp) {
      let previewB = candles[expandA_i].high;
      let previewB_i = expandA_i;
      for (let j = expandA_i; j <= lastIdx; j++) {
        if (candles[j].high > previewB) {
          previewB = candles[j].high;
          previewB_i = j;
        }
      }
      previewRange = [expandA_i, previewB_i, expandA, previewB, isUp];
    } else {
      let previewB = candles[expandA_i].low;
      let previewB_i = expandA_i;
      for (let j = expandA_i; j <= lastIdx; j++) {
        if (candles[j].low < previewB) {
          previewB = candles[j].low;
          previewB_i = j;
        }
      }
      previewRange = [expandA_i, previewB_i, expandA, previewB, isUp];
    }
  } else if (currA !== null && currB !== null) {
    previewRange = [currA_i, currB_i, currA, currB, isUp];
  }

  return { ranges, previewRange };
}

async function fetchBybitCandles(symbol, timeframe) {
  const interval = BYBIT_INTERVAL[timeframe];
  if (!interval) return [];

  const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=500`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bybit kline HTTP ${res.status}`);

  const json = await res.json();
  const list = Array.isArray(json?.result?.list) ? json.result.list : [];

  return list
    .slice()
    .reverse()
    .map(parseBybitKlineRow)
    .filter(Boolean);
}

function stateFromRange(range) {
  if (!Array.isArray(range) || typeof range[4] !== "boolean") return "neutral";
  return range[4] ? "bullish" : "bearish";
}

function stateFromResult(result, candles) {
  if (result?.previewRange) {
    return stateFromRange(result.previewRange);
  }

  const currentPrice = candles?.length ? Number(candles[candles.length - 1].close) : NaN;
  const nearest = nearestRangeToPrice(result?.ranges || [], currentPrice);
  return stateFromRange(nearest);
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

  await Promise.all(
    TIMEFRAMES.map(async (tf) => {
      try {
        const candles = await fetchBybitCandles(symbol, tf);
        const result = detectRangesWithPreview(
          candles,
          RANGE_PARAMS.correctionPct,
          RANGE_PARAMS.maxRects,
          RANGE_PARAMS.minBars
        );
        timeframes[tf] = stateFromResult(result, candles);
      } catch {
        timeframes[tf] = "neutral";
      }
    })
  );

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
