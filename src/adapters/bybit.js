const TIMEFRAMES = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];

const BYBIT_INTERVAL = {
  "1m": "1",
  "3m": "3",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
  "1w": "W",
  "1M": "M",
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

  if (!Array.isArray(candles) || candles.length < minBars) return { ranges: [], previewRange: null };

  function appendOrReplaceCurrent() {
    if (currA_i === null || currB_i === null) return;
    const bypassMinbars = (override_A_i !== null && currA_i === override_A_i);
    if (!bypassMinbars && ((currB_i - currA_i + 1) < minBars)) return;
    const item = [currA_i, currB_i, currA, currB, isUp];
    if (ranges.length && ranges[ranges.length - 1][0] === currA_i) ranges[ranges.length - 1] = item;
    else ranges.push(item);
    if (ranges.length > maxRects) ranges = ranges.slice(ranges.length - maxRects);
    if (bypassMinbars) override_A_i = null;
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
              if (!prev_fixed_on_expand) appendOrReplaceCurrent();
              if (ranges.length && ranges[ranges.length - 1][4] == isUp) {
                const last = ranges[ranges.length - 1];
                ranges[ranges.length - 1] = [last[0], expandB_i, last[2], expandB, last[4]];
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
            if (!prev_fixed_on_expand) appendOrReplaceCurrent();
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
              if (!prev_fixed_on_expand) appendOrReplaceCurrent();
              if (ranges.length && ranges[ranges.length - 1][4] == isUp) {
                const last = ranges[ranges.length - 1];
                ranges[ranges.length - 1] = [last[0], expandB_i, last[2], expandB, last[4]];
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
            if (!prev_fixed_on_expand) appendOrReplaceCurrent();
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
  return list.slice().reverse().map(parseBybitKlineRow).filter(Boolean);
}

function stateFromRange(range) {
  if (!Array.isArray(range) || typeof range[4] !== "boolean") return "neutral";
  return range[4] ? "bullish" : "bearish";
}

function stateFromResult(result, candles) {
  if (result?.previewRange) return stateFromRange(result.previewRange);
  const currentPrice = candles?.length ? Number(candles[candles.length - 1].close) : NaN;
  const nearest = nearestRangeToPrice(result?.ranges || [], currentPrice);
  return stateFromRange(nearest);
}

function pickRandom(items) {
  if (!Array.isArray(items) || !items.length) return "";
  return items[Math.floor(Math.random() * items.length)];
}

const TRIPLE_PHRASES = {
  all_neutral: [
    "Во всей группе пока нет валидных диапазонов, поэтому структура остается нейтральной.",
    "Три таймфрейма группы пока без четких диапазонов и без направленного сигнала.",
    "По группе нет оформленной структуры, поэтому вывод пока нейтральный.",
    "Внутри группы диапазоны еще не сформировались, явного перекоса нет.",
    "Все интервалы группы пока остаются в нейтральной зоне без подтвержденной структуры."
  ],
  full_bull: [
    "Вся группа таймфреймов на стороне покупателей.",
    "Структура по группе согласована вверх без явных расхождений.",
    "Покупатели удерживают контроль на всей тройке ТФ.",
    "По группе сохраняется чистый бычий перевес.",
    "Все интервалы внутри группы подтверждают рост."
  ],
  full_bear: [
    "Вся группа таймфреймов на стороне продавцов.",
    "Структура по группе согласована вниз без явных расхождений.",
    "Продавцы удерживают контроль на всей тройке ТФ.",
    "По группе сохраняется чистый медвежий перевес.",
    "Все интервалы внутри группы подтверждают снижение."
  ],
  bull_correction: [
    "На младших ТФ идет коррекция, но старший интервал группы сохраняет бычий контекст.",
    "Локальная слабость пока выглядит как откат внутри бычьей структуры.",
    "Давление на младших интервалах есть, но старший ТФ группы остается на стороне покупателей.",
    "Внутри группы идет коррекция, пока без слома бычьего диапазона на старшем ТФ.",
    "Снижение на младших ТФ пока читается как коррекционное движение в бычьем фоне."
  ],
  bear_bounce: [
    "На младших ТФ идет отскок, но старший интервал группы пока остается слабым.",
    "Рост внутри группы пока выглядит как восстановление в более медвежьем контексте.",
    "Покупатели активны локально, но старший ТФ группы еще не подтвердил разворот.",
    "Внутри группы есть отскок вверх, но старший диапазон пока не на стороне роста.",
    "Локальное улучшение есть, однако старший ТФ группы все еще выглядит слабее."
  ],
  bull_recovery: [
    "Старший и средний ТФ группы поддерживают покупателей, младший уже выглядит второстепенно.",
    "Бычий контекст внутри группы сохраняется и постепенно выравнивается.",
    "Покупатели удерживают более важные ТФ группы, а младший шум пока не ломает структуру.",
    "По группе сохраняется бычий уклон, несмотря на локальную слабость в самом младшем ТФ.",
    "Контекст в пользу покупателей остается сильнее на более значимых ТФ группы."
  ],
  bear_pressure: [
    "Старший и средний ТФ группы остаются на стороне продавцов, а младший рост пока второстепенен.",
    "Медвежий контекст внутри группы сохраняется и не сломан локальным отскоком.",
    "Продавцы удерживают более значимые ТФ группы, несмотря на слабый локальный рост.",
    "По группе сохраняется давление вниз, даже если младший ТФ пытается восстановиться.",
    "Основная структура в группе остается медвежьей, а младший импульс пока не меняет картину."
  ],
  bull_conflict: [
    "Бычий старший контекст сохраняется, но внутри группы пока остается конфликт сигналов.",
    "Старший ТФ группы удерживает рост, хотя средний интервал пока спорит с движением.",
    "По группе сохраняется бычий фон, но подтверждение внутри структуры пока неполное.",
    "Структура внутри группы неоднородна, однако старший ТФ все еще держит бычий контекст.",
    "Внутри группы есть расхождение, но старший диапазон пока остается на стороне покупателей."
  ],
  bear_conflict: [
    "Медвежий старший контекст сохраняется, но внутри группы пока остается конфликт сигналов.",
    "Старший ТФ группы удерживает слабость, хотя средний интервал пока спорит с движением.",
    "По группе сохраняется медвежий фон, но подтверждение внутри структуры пока неполное.",
    "Структура внутри группы неоднородна, однако старший ТФ все еще держит медвежий контекст.",
    "Внутри группы есть расхождение, но старший диапазон пока остается на стороне продавцов."
  ],
  mixed_neutral: [
    "Сигналы по группе смешанные, явного перекоса пока нет.",
    "Внутри группы диапазоны спорят между собой и не дают чистого перевеса.",
    "Структура по группе остается смешанной без явной доминирующей стороны.",
    "По группе пока нет цельного подтверждения ни роста, ни снижения.",
    "Состояние внутри группы остается переходным и неоднозначным."
  ],
  context_unconfirmed: [
    "Старший ТФ группы пока без валидного диапазона, поэтому сигнал остается неполным.",
    "Младшие интервалы активны, но старший контекст внутри группы еще не оформился.",
    "По группе есть движение, но без подтверждения на старшем ТФ.",
    "Старший интервал группы пока нейтрален, поэтому общий вывод остается осторожным.",
    "Контекст внутри группы еще не подтвержден, потому что старший ТФ без четкой структуры."
  ],
  bull_with_neutral: [
    "Бычий контекст в группе читается, но часть интервалов пока без подтвержденного диапазона.",
    "Внутри группы перевес скорее в сторону покупателей, хотя один из ТФ еще нейтрален.",
    "Покупатели выглядят сильнее, но структура по группе пока не полностью оформлена.",
    "По группе есть бычий уклон, однако часть интервалов еще не подтвердила движение.",
    "Контекст внутри группы больше на стороне роста, хотя не все ТФ уже сформировали диапазон."
  ],
  bear_with_neutral: [
    "Медвежий контекст в группе читается, но часть интервалов пока без подтвержденного диапазона.",
    "Внутри группы перевес скорее в сторону продавцов, хотя один из ТФ еще нейтрален.",
    "Продавцы выглядят сильнее, но структура по группе пока не полностью оформлена.",
    "По группе есть медвежий уклон, однако часть интервалов еще не подтвердила движение.",
    "Контекст внутри группы больше на стороне снижения, хотя не все ТФ уже сформировали диапазон."
  ]
};

const HIGHER_PHRASES = {
  higher_bull: [
    "Дневной, недельный и месячный диапазоны подтверждают бычий старший фон.",
    "Старшие ТФ остаются на стороне покупателей.",
    "По дневке, неделе и месяцу сохраняется сильный бычий контекст.",
    "Старшая группа интервалов согласована в пользу роста.",
    "По старшим ТФ сохраняется уверенный бычий фон."
  ],
  higher_bear: [
    "Дневной, недельный и месячный диапазоны подтверждают медвежий старший фон.",
    "Старшие ТФ остаются на стороне продавцов.",
    "По дневке, неделе и месяцу сохраняется сильный медвежий контекст.",
    "Старшая группа интервалов согласована в пользу снижения.",
    "По старшим ТФ сохраняется уверенный медвежий фон."
  ],
  higher_bull_pullback: [
    "Старший бычий фон сохраняется, хотя дневка ушла в откат.",
    "Месяц и неделя удерживает более сильный фон, а дневка выглядят коррекционно.",
    "Слабость внутри старшей группы пока похожа на откат против более сильного старшего контекста.",
    "По старшей группе идет коррекция, но главный фон пока не сломан.",
    "Нисходящее давление есть, но старший контекст группы пока остается бычьим."
  ],
  higher_bear_bounce: [
    "Старший медвежий фон сохраняется, хотя более младшие старшие ТФ пытаются восстановиться.",
    "Месяц остается слабым, а дневка и неделя пока выглядят как отскок.",
    "Рост внутри старшей группы пока похож на восстановление против более тяжелого контекста.",
    "По старшей группе есть отскок, но главный фон пока не изменился.",
    "Покупатели оживились, однако старший контекст группы остается слабым."
  ],
  higher_mixed: [
    "Старшие ТФ пока спорят между собой и не дают цельного сигнала.",
    "Дневка, неделя и месяц пока не согласованы по одному направлению.",
    "По старшей группе структура остается смешанной и переходной.",
    "Старший контекст пока неоднороден и без чистого подтверждения.",
    "В старшей группе нет единого перекоса, сигналы пока смешанные."
  ],
  higher_with_neutral: [
    "Часть старших ТФ уже читается, но полноценного подтверждения по всей группе пока нет.",
    "Старший контекст виден частично, однако один из ТФ остается нейтральным.",
    "По старшей группе есть намек на направление, но структура пока неполная.",
    "Старший фон читается не полностью, потому что часть интервалов без валидного диапазона.",
    "Контекст на старших ТФ есть, но он пока не оформлен по всей группе."
  ],
  higher_neutral: [
    "По дневному, недельному и месячному ТФ пока нет четкого старшего сигнала.",
    "Старшие интервалы остаются нейтральными без валидного диапазона.",
    "Дневка, неделя и месяц пока не дают ясного долгосрочного перекоса.",
    "Старший контекст еще не оформился и остается нейтральным.",
    "По старшим ТФ структура пока размыта и без явного направления."
  ]
};

function classifyTriple(states) {
  const [low, mid, high] = states;
  const bulls = states.filter((s) => s === "bullish").length;
  const bears = states.filter((s) => s === "bearish").length;
  const neutrals = states.filter((s) => s === "neutral").length;

  if (neutrals === 3) return "all_neutral";
  if (high === "neutral") return "context_unconfirmed";

  if (bulls === 3) return "full_bull";
  if (bears === 3) return "full_bear";

  if (high === "bullish") {
    if (low === "bearish" && mid === "bearish") return "bull_correction";
    if (low === "bearish" && mid === "bullish") return "bull_recovery";
    if (low === "bullish" && mid === "bearish") return "bull_conflict";
    if (neutrals >= 1 && bulls >= 1 && bears === 0) return "bull_with_neutral";
    if (neutrals >= 1 && bears >= 1) return "context_unconfirmed";
    return "bull_conflict";
  }

  if (high === "bearish") {
    if (low === "bullish" && mid === "bullish") return "bear_bounce";
    if (low === "bullish" && mid === "bearish") return "bear_pressure";
    if (low === "bearish" && mid === "bullish") return "bear_conflict";
    if (neutrals >= 1 && bears >= 1 && bulls === 0) return "bear_with_neutral";
    if (neutrals >= 1 && bulls >= 1) return "context_unconfirmed";
    return "bear_conflict";
  }

  return "mixed_neutral";
}

function classifyHigher(states) {
  const [dayState, weekState, monthState] = states;
  const bulls = states.filter((s) => s === "bullish").length;
  const bears = states.filter((s) => s === "bearish").length;
  const neutrals = states.filter((s) => s === "neutral").length;

  if (neutrals === 3) return "higher_neutral";
  if (neutrals >= 1) return "higher_with_neutral";
  if (bulls === 3) return "higher_bull";
  if (bears === 3) return "higher_bear";

  if (monthState === "bullish" && bears >= 1) return "higher_bull_pullback";
  if (monthState === "bearish" && bulls >= 1) return "higher_bear_bounce";

  return "higher_mixed";
}

function phraseForTriple(states) {
  const type = classifyTriple(states);
  return pickRandom(TRIPLE_PHRASES[type] || TRIPLE_PHRASES.mixed_neutral);
}

function phraseForHigher(states) {
  const type = classifyHigher(states);
  return pickRandom(HIGHER_PHRASES[type] || HIGHER_PHRASES.higher_mixed);
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
        lower_tf: "Символ проекта не задан, поэтому младшая группа остается нейтральной.",
        mid_tf: "Символ проекта не задан, поэтому средняя группа остается нейтральной.",
        higher_tf: "Символ проекта не задан, поэтому старший контекст не определен.",
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
      lower_tf: phraseForTriple([timeframes["1m"], timeframes["3m"], timeframes["5m"]]),
      mid_tf: phraseForTriple([timeframes["15m"], timeframes["1h"], timeframes["4h"]]),
      higher_tf: phraseForHigher([timeframes["1d"], timeframes["1w"], timeframes["1M"]]),
    },
  };
}
