function getSlug() {
  const url = new URL(window.location.href);
  return url.searchParams.get("slug") || "eth";
}

const METRIC_HELP = {
  "Цена": "Текущая рыночная цена актива.",
  "Рыночная капитализация": "Цена актива, умноженная на количество монет в обращении.",
  "FDV": "Полностью разводненная оценка. Показывает капитализацию, если учитывать всё потенциальное предложение.",
  "Объем 24ч": "Суммарный объем торгов за последние 24 часа.",
  "TVL": "Total Value Locked. Объем капитала, заблокированного в протоколах экосистемы.",
  "Стейблкоины в сети": "Общий объем стейблкоинов внутри сети.",
  "Комиссии протокола 24ч": "Комиссии, созданные торговой активностью продукта за последние 24 часа.",
  "Сетевые комиссии 24ч": "Сумма сетевых комиссий за последние 24 часа.",
  "DEX-оборот 24ч": "Объем торгов на децентрализованных биржах внутри сети за 24 часа.",
  "Объем 24ч / капитализация": "Показывает, какой процент от рыночной капитализации составил суточный объем торгов.",
  "Активные RWA": "Активная рыночная капитализация токенизированных реальных активов в сети по данным DefiLlama.",
  "Market Cap / TVL": "Сравнение капитализации актива с капиталом внутри сети.",
  "Stablecoins / TVL": "Отношение объема стейблкоинов в сети к TVL.",
  "В обращении": "Количество монет, которые реально находятся в обращении.",
  "Текущее предложение": "Общее текущее предложение монет.",
  "Максимальное предложение": "Максимально возможное предложение, если оно существует.",
  "Чистая эмиссия": "Изменение предложения после выпуска новых монет и сжигания.",
  "Механизм сжигания": "Механизм сжигания или изъятия части предложения из оборота.",
  "Выкуп с рынка": "Наличие или отсутствие классического выкупа токена с рынка.",
  "Активные адреса за день": "Количество активных адресов за день.",
  "Новые адреса": "Количество новых адресов за период.",
  "Транзакции": "Количество транзакций за период.",
  "Статус оценки": "Краткая качественная оценка текущей стадии актива.",
  "MVRV": "Отношение рыночной капитализации BTC к realized cap; помогает оценивать фазу рынка.",
  "Realized Price": "Средняя on-chain стоимость приобретения BTC, рассчитанная из realized cap.",
  "ETF Net Flow (latest)": "Чистый совокупный поток американских spot BTC ETF за последний опубликованный торговый день.",
  "ETF Net Flow (5d)": "Суммарный чистый поток американских spot BTC ETF за последние пять опубликованных торговых дней.",
  "ETF Cumulative Net Flow": "Накопленный чистый поток американских spot BTC ETF с момента запуска.",
  "NUPL": "Нереализованная прибыль или убыток рынка относительно рыночной капитализации.",
  "BTC Dominance": "Доля Bitcoin в общей капитализации крипторынка.",
  "В обращении от 21M": "Доля максимального предложения Bitcoin, уже находящаяся в обращении.",
  "Годовой темп эмиссии": "Текущий годовой темп выпуска новых BTC относительно предложения.",
  "Value capture": "Механика, связывающая экономику продукта со спросом или поддержкой токена.",
  "Annualized Fees / Market Cap": "Годовой эквивалент текущих комиссий относительно рыночной капитализации.",
  "DEX Volume / Market Cap": "Суточный оборот торговой площадки относительно рыночной капитализации токена."
};


function injectEnhancementStyles() {
  if (document.getElementById("report-enhancement-styles")) return;
  const style = document.createElement("style");
  style.id = "report-enhancement-styles";
  style.textContent = `
    .section-sub{color:var(--muted);font-size:14px;margin-top:6px}
    .chart-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
    .chart-shell{margin-top:16px;height:380px;border:1px solid var(--line);border-radius:20px;padding:14px;background:rgba(255,255,255,.02);position:relative}
    .tv-shell{margin-top:16px;height:640px;border:1px solid var(--line);border-radius:20px;overflow:hidden;background:rgba(255,255,255,.02)}
    .top-gap{margin-top:18px}
    .three-col{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
    .three-col .list-item{min-height:92px}
    .ta-meta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:16px}
    .ta-meta-box{min-width:220px;padding:14px 16px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.03)}
    .ta-meta-value{margin-top:8px;font-size:16px;font-weight:800}
    .ta-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:18px}
    .ta-group{display:flex;flex-direction:column;gap:14px}
    .ta-group-chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .bias-chip{padding:14px 12px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.03);text-align:center;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;min-height:52px}
    .bias-dot{width:10px;height:10px;border-radius:50%;display:inline-block;background:#9aa4ba}
    .bias-chip.bullish .bias-dot{background:#54d38a}
    .bias-chip.bearish .bias-dot{background:#ff5b7f}
    .bias-chip.neutral .bias-dot{background:#9aa4ba}
    .metric-top-row{display:flex;align-items:center;justify-content:space-between;gap:10px}
    .metric-status-line{font-size:12px;color:#d5def5;margin-top:10px}
    .status-chip{display:inline-flex;align-items:center;justify-content:center;min-width:68px;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.02em;text-transform:none;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#dce6ff}
    .status-chip.live{background:rgba(84,211,138,.14);color:#8cf0b4;border-color:rgba(84,211,138,.35)}
    .status-chip.static{background:rgba(154,117,255,.14);color:#cdbaff;border-color:rgba(154,117,255,.35)}
    .status-chip.manual{background:rgba(180,188,205,.10);color:#d9e1f2;border-color:rgba(180,188,205,.22)}
    .status-chip.calculated{background:rgba(86,145,255,.14);color:#a8c7ff;border-color:rgba(86,145,255,.35)}
    .status-chip.partial{background:rgba(255,196,86,.14);color:#ffd88b;border-color:rgba(255,196,86,.35)}
    .status-chip.unavailable,.status-chip.unknown{background:rgba(255,91,127,.12);color:#ff9db1;border-color:rgba(255,91,127,.25)}
    .info-wrap{position:relative;display:inline-flex;vertical-align:middle;margin-left:6px}
    .info-icon{width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:#dce6ff;border:1px solid var(--line);background:rgba(255,255,255,.06);cursor:help}
    .tooltip{position:absolute;left:50%;bottom:125%;transform:translateX(-50%);min-width:220px;max-width:280px;padding:10px 12px;border-radius:12px;background:#15191f;color:#eef3ff;border:1px solid rgba(255,255,255,.12);box-shadow:0 10px 30px rgba(0,0,0,.35);font-size:12px;line-height:1.45;opacity:0;pointer-events:none;transition:opacity .15s ease;z-index:20}
    .info-wrap:hover .tooltip{opacity:1}
    .compact-panel{padding:18px 24px}
    .status-banner-row{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap}
    .status-banner-left{display:flex;gap:10px;align-items:center}
    .status-banner-title{font-weight:800;color:#eef3ff}
    .status-banner-text{color:var(--muted);max-width:760px;line-height:1.6}
    .chart-controls{display:flex;gap:8px;flex-wrap:wrap}
    .range-btn{padding:8px 12px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:#dce6ff;font-weight:700;cursor:pointer}
    .range-btn.active{background:rgba(86,145,255,.14);border-color:rgba(86,145,255,.35);color:#a8c7ff}
    .chart-note{margin-top:12px;color:var(--muted);font-size:13px}
    .empty-chart{position:absolute;inset:14px;display:flex;align-items:center;justify-content:center;border:1px dashed rgba(255,255,255,.08);border-radius:16px;color:#a8b2c7;font-size:14px;text-align:center;padding:24px}
    @media (max-width:1180px){.three-col,.ta-groups,.ta-group-chips{grid-template-columns:1fr}.tv-shell{height:520px}}
  `;
  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusChip(status = "unknown") {
  const labelMap = { live:"Актуально", static:"Статика", manual:"Вручную", calculated:"Расчет", partial:"Частично", unavailable:"Нет данных", unknown:"Неизвестно" };
  const titleMap = {
    live:"Получено из актуального внешнего источника.",
    static:"Структурная характеристика протокола. Не требует регулярного обновления.",
    calculated:"Рассчитано автоматически на основе актуальных данных.",
    partial:"Доступна только часть актуальных данных.",
    unavailable:"Данные временно недоступны.",
    manual:"Заполнено вручную и требует периодической проверки.",
  };
  return `<span class="status-chip ${escapeHtml(status)}" title="${escapeHtml(titleMap[status] || "Статус данных")}">${labelMap[status] || status}</span>`;
}

function hasNoLiveUsers(metrics) {
  if (!metrics || typeof metrics !== "object") return true;
  return Object.values(metrics).every((metric) => {
    const value = Number(metric?.value);
    const formatted = String(metric?.formatted || "").toLowerCase();
    return !Number.isFinite(value) && (formatted === "—" || formatted.includes("источник подключается"));
  });
}

function shouldRenderSection(report, section) {
  const status = report?.meta?.section_selection?.sections?.[section]?.status;
  if (!status) return true;
  return status === "enabled" || status === "partial";
}

function shouldRenderUsersBlock(report) {
  const explicitRule = report?.meta?.features?.usersBlock;
  if (explicitRule === true) return true;
  if (explicitRule === false) return false;
  return !!report?.users;
}


function metricSlotsHtml(report, slot) {
  const selected = report?.metric_slots?.[slot];
  return Array.isArray(selected) ? selected.map((item) => metricHtml(item.label, item.metric)).join("") : "";
}

function metricSlotsExcludingHtml(report, slot, excludeKeys) {
  const selected = report?.metric_slots?.[slot];
  const excluded = new Set(excludeKeys);
  return Array.isArray(selected) ? selected.filter((item) => !excluded.has(item.key)).map((item) => metricHtml(item.label, item.metric)).join("") : "";
}

function hasChartSlot(report, key) {
  return Array.isArray(report?.chart_slots) && report.chart_slots.some((slot) => slot.key === key);
}

function selectedChartHtml(report, key, id, label, caption) {
  return hasChartSlot(report, key) ? compactChartHtml(id, label, caption) : "";
}

function selectedChartGroupHtml(report, className, definitions) {
  const charts = definitions.map(([key, id, label, caption]) => selectedChartHtml(report, key, id, label, caption)).filter(Boolean).join("");
  return charts ? `<div class="${className}">${charts}</div>` : "";
}

function marketPackHtml(report) {
  const category = report?.meta?.project_profile?.category;
  const marketCharts = [
    selectedChartHtml(report, "volume_history", "volumeHistoryChart", "Объем торгов", "История рыночного оборота"),
    selectedChartHtml(report, "market_cap_history", "marketCapHistoryChart", "Рыночная капитализация", "История рыночной оценки"),
  ].filter(Boolean).join("");
  if (!["macro", "meme", "utility", "defi", "trading_venue"].includes(category) && !marketCharts) return "";
  const heroKeys = ["macro", "meme"].includes(category) && Array.isArray(report?.hero?.kpis) ? report.hero.kpis.map((item) => item.key) : [];
  const metrics = metricSlotsExcludingHtml(report, "market", heroKeys);
  if (!metrics && !marketCharts) return "";
  return `<section class="panel section-flow market-pack-section"><div class="section-title">Рынок и торговля</div><div class="section-sub">Ликвидность, оборот и качество рынка.</div>${metrics ? `<div class="hero-grid market-kpis">${metrics}</div>` : ""}${marketCharts ? `<div class="capital-charts">${marketCharts}</div>` : ""}${insightHtml(report.liquidity)}</section>`;
}

function heroKpisHtml(report) {
  const selected = report?.hero?.kpis;
  if (Array.isArray(selected)) return selected.map((item) => metricHtml(item.label, item.metric)).join("");
  return [
    ["Цена", report?.market?.price], ["Рыночная капитализация", report?.market?.market_cap],
    ["FDV", report?.market?.fdv], ["Объем 24ч", report?.market?.volume_24h],
    ["TVL", report?.capital?.metrics?.tvl], ["Stablecoins Mcap", report?.capital?.metrics?.stablecoins_mcap],
  ].map(([label, metric]) => metricHtml(label, metric)).join("");
}

function demandFlowsSectionHtml(report) {
  if (!shouldRenderSection(report, "demand_and_flows") || !report?.demand_flows) return "";
  const metrics = [
    ["BTC Dominance", report.demand_flows?.metrics?.btc_dominance],
    ["ETF Net Flow (latest)", report.demand_flows?.metrics?.etf_latest_net_flow],
    ["ETF Net Flow (5d)", report.demand_flows?.metrics?.etf_five_day_net_flow],
    ["ETF Cumulative Net Flow", report.demand_flows?.metrics?.etf_cumulative_net_flow],
    ["MVRV", report.valuation?.metrics?.mvrv],
    ["Realized Price", report.valuation?.metrics?.realized_price],
    ["NUPL", report.valuation?.metrics?.nupl],
  ].filter(([, metric]) => metric);
  const charts = selectedChartGroupHtml(report, "capital-charts", [
    ["mvrv_history", "mvrvChart", "MVRV", "Рыночная оценка относительно realized cap"],
    ["realized_price_history", "realizedPriceChart", "Realized Price vs Market Price", "Рыночная цена относительно средней on-chain стоимости"],
    ["btc_etf_flow_history", "btcEtfFlowChart", "Spot BTC ETF Net Flow", "Ежедневный совокупный приток или отток капитала через американские spot ETF"],
    ["btc_etf_cumulative_history", "btcEtfCumulativeChart", "Spot BTC ETF Cumulative Flow", "Накопленный чистый поток с момента запуска spot ETF"],
    ["issuance_history", "issuanceChart", "Годовой темп эмиссии", "Предсказуемое замедление выпуска новых BTC"],
  ]);
  const text = Array.isArray(report.demand_flows.text) ? report.demand_flows.text.map((line) => `<p class="lead compact-lead">${escapeHtml(line)}</p>`).join("") : "";
  return `<section class="panel section-flow"><div class="section-title">Спрос и потоки</div><div class="section-sub">Рыночная фаза, относительная сила и сигналы устойчивости спроса.</div>${text}<div class="hero-grid">${metrics.map(([label, metric]) => metricHtml(label, metric)).join("")}</div>${charts}${insightHtml(report.demand_flows)}</section>`;
}

function finalVerdictHtml(report) {
  if (!shouldRenderSection(report, "final_summary")) return "";
  const verdict = report?.final_verdict;
  if (!Array.isArray(verdict?.paragraphs) || !verdict.paragraphs.length) return "";
  return `<section class="panel final-verdict"><div class="section-title">Финальная оценка</div>${verdict.subtitle ? `<div class="section-sub">${escapeHtml(verdict.subtitle)}</div>` : ""}${verdict.paragraphs.map((paragraph) => `<p class="lead compact-lead">${escapeHtml(paragraph)}</p>`).join("")}</section>`;
}

function usersSectionHtml(report) {
  if (!shouldRenderSection(report, "users_and_activity") || !shouldRenderUsersBlock(report)) return "";
  const users = report?.users || {};
  const metrics = users.metrics || {};
  const text = Array.isArray(users.text) ? users.text : [];
  return `<section class="panel"><div class="section-title">${escapeHtml(users.title || "Активность пользователей")}</div>${text.map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid">${metricHtml("Активные адреса за день", metrics.daily_active_addresses)}${metricHtml("Новые адреса", metrics.new_addresses)}${metricHtml("Транзакции", metrics.transactions)}</div>${hasNoLiveUsers(metrics) ? `<div class="three-col top-gap">${buildUsersStatusCard(metrics)}</div>` : ""}</section>`;
}

const COMPACT_NUMBER_UNITS = [
  { value: 1e3, suffix: "K" },
  { value: 1e6, suffix: "M" },
  { value: 1e9, suffix: "B" },
  { value: 1e12, suffix: "T" },
];

function formatCompactNumber(value, maximumFractionDigits = 2) {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  let unitIndex = -1;
  for (let index = 0; index < COMPACT_NUMBER_UNITS.length; index += 1) {
    if (abs >= COMPACT_NUMBER_UNITS[index].value) unitIndex = index;
  }
  if (unitIndex < 0) return Number(value.toFixed(maximumFractionDigits)).toString();

  let scaled = value / COMPACT_NUMBER_UNITS[unitIndex].value;
  const rounded = Number(scaled.toFixed(maximumFractionDigits));
  if (Math.abs(rounded) >= 1000 && unitIndex < COMPACT_NUMBER_UNITS.length - 1) {
    unitIndex += 1;
    scaled = value / COMPACT_NUMBER_UNITS[unitIndex].value;
  }
  return `${Number(scaled.toFixed(maximumFractionDigits))}${COMPACT_NUMBER_UNITS[unitIndex].suffix}`;
}

function metricFormattedValue(metric) {
  const formatted = metric?.formatted;
  const value = metric?.value;
  const isRawNumericFormat = typeof formatted === "number"
    || (typeof formatted === "string" && /^[+-]?[\d\s.,\u00a0\u202f]+$/.test(formatted.trim()));
  if (Number.isFinite(value) && Math.abs(value) >= 1e3 && (formatted == null || formatted === "" || isRawNumericFormat)) {
    return formatCompactNumber(value);
  }
  return formatted ?? "—";
}

function isRenderableMetric(metric) {
  if (!metric || metric.status === "unavailable" || metric.status === "unknown") return false;
  if (metric.value !== null && metric.value !== undefined) return true;
  const formatted = String(metric.formatted ?? "").trim().toLowerCase();
  return Boolean(formatted) && !["—", "-", "n/a", "na", "unknown", "данные временно недоступны", "источник подключается"].includes(formatted)
    && !formatted.includes("временно недоступ");
}

function sourceLabel(source) {
  const normalized = String(source || "").trim();
  const labels = { calc:"Расчет", analyst:"Аналитическая оценка", "project structure":"Структура проекта", "profile semantics":"Семантика профиля" };
  return labels[normalized.toLowerCase()] || normalized || "Не указан";
}

function metricHtml(title, metric) {
  if (!isRenderableMetric(metric)) return "";
  const help = METRIC_HELP[title]
    ? `<span class="info-wrap"><span class="info-icon">i</span><span class="tooltip">${escapeHtml(METRIC_HELP[title])}</span></span>`
    : "";
  const freshness = metric?.updated_at ? ` · ${escapeHtml(formatShortDate(metric.updated_at))}` : "";
  const valueClass = String(metricFormattedValue(metric)).length > 18 ? " metric-value-long" : "";
  return `<div class="metric-box"><div class="metric-top-row"><div class="metric-title">${escapeHtml(title)} ${help}</div>${statusChip(metric?.status || "unknown")}</div><div class="metric-value${valueClass}">${escapeHtml(metricFormattedValue(metric))}</div><div class="metric-status-line">Источник: ${escapeHtml(sourceLabel(metric?.source))}${freshness}</div></div>`;
}

function optionalMetricHtml(title, metric) {
  return metric ? metricHtml(title, metric) : "";
}

function formatShortDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { day:"2-digit", month:"short", year:"numeric" }).format(date) : "";
}
const CHART_RANGES = ["1M", "3M", "6M", "YTD", "1Y", "ALL"];
const DEFAULT_CHART_RANGE = "ALL";

function compactChartHtml(id, label, caption) {
  const ranges = CHART_RANGES;
  return `<div class="integrated-chart" id="${id}-card"><div class="chart-label"><span>${escapeHtml(label)}</span><span class="chart-range" id="${id}-range-label">${DEFAULT_CHART_RANGE}</span></div><div class="chart-range-controls" aria-label="Диапазон ${escapeHtml(label)}">${ranges.map((range) => `<button class="range-btn${range === DEFAULT_CHART_RANGE ? " active" : ""}" type="button" data-chart="${id}" data-range="${range}">${range}</button>`).join("")}</div><div class="chart-shell" id="${id}-wrap"><canvas id="${id}"></canvas></div><div class="chart-navigator" id="${id}-navigator"><div class="navigator-track"></div><input class="navigator-input navigator-start" type="range" min="0" max="1" value="0" aria-label="Начало диапазона ${escapeHtml(label)}"><input class="navigator-input navigator-end" type="range" min="0" max="1" value="1" aria-label="Конец диапазона ${escapeHtml(label)}"></div><div class="chart-caption">${escapeHtml(caption)}</div></div>`;
}
function projectIconHtml(meta = {}, compact = false) {
  const ticker = String(meta.ticker || "").toUpperCase();
  const branding = meta.branding || {};
  const key = String(branding.iconKey || ticker).toLowerCase();
  const label = escapeHtml(meta.project_name || ticker || "Project");
  const accent = /^#[0-9a-f]{6}$/i.test(branding.accent || "") ? branding.accent : "#7898df";
  const fallback = `<span class="project-icon-fallback">${escapeHtml(ticker.slice(0, 4) || "•")}</span>`;
  const icons = {
    bitcoin:`<span class="brand-letter bitcoin-letter">₿</span>`,
    ethereum:`<svg viewBox="0 0 256 417" aria-hidden="true"><path class="eth-top-left" d="M127.9 0L125.1 9.5v274.2l2.8 2.8 127.9-75.6z"/><path class="eth-top-right" d="M127.9 0L0 210.9l127.9 75.6V154.1z"/><path class="eth-bottom-left" d="M127.9 310.7l-1.6 1.9v98.2l1.6 4.7 128-180.3z"/><path class="eth-bottom-right" d="M127.9 415.5V310.7L0 235.2z"/><path class="eth-center-left" d="M127.9 286.5l127.9-75.6-127.9-56.8z"/><path class="eth-center-right" d="M0 210.9l127.9 75.6V154.1z"/></svg>`,
    solana:`<svg viewBox="0 0 128 104" aria-hidden="true"><defs><linearGradient id="sol-g" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#9945ff"/><stop offset="1" stop-color="#14f195"/></linearGradient></defs><path fill="url(#sol-g)" d="M25 0h91l-13 17H12zM12 43h91l13 17H25zM25 86h91l-13 17H12z"/></svg>`,
    dogecoin:`<span class="brand-letter dogecoin-letter">Ð</span>`,
    pepe:`<span class="brand-word pepe-word">PEPE</span>`,
    bnb:`<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="#f3ba2f" d="M50 5 65 20 50 35 35 20zm-30 30 15 15-15 15L5 50zm60 0 15 15-15 15-15-15zM50 65l15 15-15 15-15-15zm0-30 15 15-15 15-15-15z"/></svg>`,
    chainlink:`<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="none" stroke="#5578ff" stroke-width="15" d="M50 8 86 29v42L50 92 14 71V29z"/></svg>`,
    hyperliquid:`<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="none" stroke="#97fce4" stroke-width="12" stroke-linecap="round" d="M12 58c9-25 20-25 29 0s20 25 29 0 14-24 18-16"/></svg>`,
    pendle:`<span class="brand-word">P</span>`,
    curve:`<span class="brand-word">CRV</span>`,
    mantle:`<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="none" stroke="#d7ff3f" stroke-width="10" stroke-linejoin="round" d="M12 76V24l19 26 19-26 19 26 19-26v52"/></svg>`,
    near:`<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="none" stroke="#7cf7c4" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" d="M18 78V22l64 56V22L18 78"/></svg>`,
  };
  const remote = typeof branding.iconUrl === "string" && /^https:\/\//i.test(branding.iconUrl)
    ? `<img src="${escapeHtml(branding.iconUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`
    : "";
  return `<span class="project-icon${compact ? " project-icon-compact" : ""}" aria-label="${label}" style="--project-accent:${accent}">${remote}${icons[key] || fallback}</span>`;
}
function tokenomicsSectionHtml(report) {
  if (!shouldRenderSection(report, "tokenomics")) return "";
  return `<section class="panel section-flow tokenomics-section"><div class="section-title">Токеномика</div><div class="section-sub">Предложение и механики влияния на держателя.</div><div class="hero-grid">${metricSlotsHtml(report, "tokenomics")}</div>${insightHtml(report.tokenomics)}</section>`;
}

function utilityAdoptionSectionHtml(report) {
  if (!shouldRenderSection(report, "utility_and_adoption")) return "";
  const block = report?.utility_adoption || {};
  const items = Array.isArray(block.items) ? block.items : [];
  const metrics = [
    ["Роль токена", report?.semantic_metrics?.token_utility],
    ["Adoption / интеграции", report?.semantic_metrics?.adoption],
    ["Value capture LINK", report?.semantic_metrics?.value_capture],
  ].filter(([, metric]) => metric);
  return `<section class="panel section-flow utility-adoption-section"><div class="section-title">Utility, adoption и роль в инфраструктуре</div><div class="section-sub">Как использование oracle-сервисов и интеграций может превращаться в спрос на токен.</div>${metrics.length ? `<div class="hero-grid">${metrics.map(([label, metric]) => metricHtml(label, metric)).join("")}</div>` : ""}<div class="list-wrap top-gap">${listHtml(items)}</div>${insightHtml(block)}</section>`;
}

function financialsSectionHtml(report) {
  if (!shouldRenderSection(report, "financials")) return "";
  const hybrid = report?.meta?.semantic_profile === "hybrid_ecosystem";
  const tradingVenue = report?.meta?.semantic_profile === "trading_venue";
  const productDefi = report?.meta?.project_profile?.analysisProfile === "product_defi_economics";
  const protocolEconomics = tradingVenue || productDefi;
  const title = protocolEconomics ? "Экономика протокола" : (hybrid ? "Экономика BNB ecosystem" : "Экономика сети");
  const subtitle = protocolEconomics ? "Комиссии, торговая активность, value capture и оценка относительно использования продукта." : (hybrid ? "On-chain экономика BNB Chain и сигналы спроса вокруг Binance ecosystem." : "Платный спрос и устойчивость экономической активности.");
  return `<section class="panel section-flow finance-section"><div class="section-title">${title}</div><div class="section-sub">${subtitle}</div><div class="hero-grid finance-kpis">${metricSlotsHtml(report, "financial")}</div>${selectedChartGroupHtml(report, "financial-fee-charts", [["app_fees_history", "appFeesChart", "App Fees", "Платная активность приложений"], ["chain_fees_history", "chainFeesChart", "Chain Fees", "Платный спрос на базовый слой"]])}${selectedChartGroupHtml(report, "chart-stack", [["dex_history", "dexChart", "DEX-оборот", "Торговый оборот внутри сети"]])}${insightHtml(report.financials)}</section>`;
}

function capitalSectionHtml(report) {
  if (!shouldRenderSection(report, "tvl_and_capital")) return "";
  const hybrid = report?.meta?.semantic_profile === "hybrid_ecosystem";
  const protocolAsset = ["trading_venue", "defi"].includes(report?.meta?.semantic_profile);
  const title = hybrid ? "BNB Chain / капитал экосистемы" : (protocolAsset ? "Капитал / TVL / ликвидность" : "Капитал в сети");
  const subtitle = hybrid ? "TVL и стейблкоины как важный, но не единственный слой спроса на BNB." : (protocolAsset ? "Капитал и ликвидность, которые поддерживают использование продукта и его оценку." : "TVL и ликвидность внутри экосистемы.");
  return `<section class="panel section-flow capital-section"><div class="section-title">${title}</div><div class="section-sub">${subtitle}</div><div class="hero-grid capital-kpis">${metricSlotsHtml(report, "capital")}</div>${selectedChartGroupHtml(report, "capital-charts", [["tvl_history", "tvlChart", "TVL", "Капитал в приложениях сети"], ["stablecoins_history", "stableChart", "Stablecoins", "Ликвидность для расчетов и торговли"]])}${insightHtml(report.capital)}</section>`;
}

function summarySectionHtml(report) {
  if (!shouldRenderSection(report, "risks") && !shouldRenderSection(report, "final_summary")) return "";
  return `<section class="panel summary-panel"><div class="section-title">Резюме</div><div class="section-sub">Сильные стороны, ограничения, риски и сигналы для наблюдения.</div><div class="columns-4 profile-grid"><div><h3>Сильные стороны</h3>${listHtml(report.profile.strengths)}</div><div><h3>Ограничения</h3>${listHtml(report.profile.weaknesses)}</div><div><h3>Риски</h3>${listHtml(report.profile.risks)}</div><div><h3>Что отслеживать</h3>${listHtml(report.profile.watch)}</div></div></section>`;
}

function newsHtml(news = {}, report = {}) {
  if (!shouldRenderSection(report, "narrative_and_news")) return "";
  const items = Array.isArray(news.items) ? news.items : [];
  const body = items.length ? `<div class="news-list">${items.map((item) => `<a class="news-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><div class="news-meta"><span class="news-source">${escapeHtml(item.source || news.source || "Источник")}</span><span class="news-date">${escapeHtml(formatShortDate(item.date))}</span></div><h3>${escapeHtml(item.title)}</h3>${item.snippet ? `<p>${escapeHtml(item.snippet)}</p>` : ""}</a>`).join("")}</div>` : `<div class="news-empty">${escapeHtml(news.source_summary || "Свежих релевантных новостей за выбранный период не найдено")}</div>`;
  const freshness = news.updated_at ? `Обновлено ${new Date(news.updated_at).toLocaleString("ru-RU")}` : "Актуальная лента";
  return `<section class="panel news-section"><div class="section-title">Последние новости</div><div class="section-sub">События, способные изменить тезис по ${escapeHtml(report?.meta?.project_name || report?.meta?.ticker || "проекту")}. · ${escapeHtml(freshness)}</div>${body}${insightHtml(report.narrative)}</section>`;
}

function orderedReportSectionsHtml(report) {
  const renderers = {
    tokenomics: () => tokenomicsSectionHtml(report),
    demand_and_flows: () => demandFlowsSectionHtml(report),
    financials: () => financialsSectionHtml(report),
    utility_and_adoption: () => utilityAdoptionSectionHtml(report),
    tvl_and_capital: () => capitalSectionHtml(report),
    users_and_activity: () => usersSectionHtml(report),
    summary: () => summarySectionHtml(report),
    final_verdict: () => finalVerdictHtml(report),
    narrative_and_news: () => newsHtml(report.news, report),
  };
  const fallbackOrder = ["tokenomics", "financials", "tvl_and_capital", "users_and_activity", "summary", "final_verdict", "narrative_and_news"];
  const order = Array.isArray(report?.meta?.section_order) ? report.meta.section_order : fallbackOrder;
  return order.map((section) => renderers[section]?.() || "").join("");
}

function listHtml(items = []) {
  return items.map((item) => `<div class="list-item">${escapeHtml(item)}</div>`).join("");
}

function explanationListHtml(items = []) {
  if (!Array.isArray(items) || !items.length) return "";
  return `<div class="list-wrap top-gap">${items.map((item) => `<div class="list-item"><strong>${escapeHtml(item.title || "Метрика")}</strong><br>${escapeHtml(item.text || "—")}</div>`).join("")}</div>`;
}

function insightHtml(block = {}) {
  const conclusion = block?.conclusion;
  if (!conclusion) return "";
  return `<div class="list-item section-insight top-gap"><strong>Краткий вывод</strong><span>${escapeHtml(conclusion)}</span></div>`;
}

function insightPanelHtml(block = {}) {
  const conclusion = block?.conclusion;
  if (!conclusion) return "";
  return `<section class="panel compact-panel"><div class="status-banner-row"><div><div class="status-banner-title">Что значат данные</div><div class="status-banner-text">${escapeHtml(conclusion)}</div></div></div></section>`;
}

function chartCard(id, title, subtitle = "", controlsHtml = "", note = "") {
  return `<section class="panel"><div class="chart-head"><div><div class="section-title">${escapeHtml(title)}</div>${subtitle ? `<div class="section-sub">${escapeHtml(subtitle)}</div>` : ""}</div>${controlsHtml ? `<div class="chart-controls">${controlsHtml}</div>` : ""}</div>${note ? `<div class="chart-note">${escapeHtml(note)}</div>` : ""}<div class="chart-shell" id="${id}-wrap"><canvas id="${id}"></canvas></div></section>`;
}

function tradingViewCard(symbol) {
  const content = symbol
    ? `<div id="tv-widget" style="width:100%;height:100%;"></div>`
    : `<div class="error-box">Торговая пара не найдена на поддерживаемых биржах. График не подменяется другим рынком.</div>`;
  return `<section class="panel"><div class="section-title">График цены</div><div class="section-sub">Интерактивный график TradingView для проверки рыночной структуры</div><div class="tv-shell">${content}</div></section>`;
}

function normalizeLlamaSeries(rows = [], key) {
  return (rows || []).map((row) => {
    const rawTs = Number(row?.date);
    const ts = Number.isFinite(rawTs) ? (rawTs < 1e12 ? rawTs * 1000 : rawTs) : null;
    let raw = row?.[key];
    if (raw && typeof raw === "object") {
      // totalCirculatingUSD contains USD-converted peg buckets; their sum is
      // DefiLlama's full chain Stablecoins Mcap, not only the peggedUSD subset.
      const bucketValues = Object.values(raw).map(Number).filter(Number.isFinite);
      raw = bucketValues.length ? bucketValues.reduce((total, value) => total + value, 0) : null;
    }
    if (raw == null) raw = row?.totalLiquidityUSD ?? row?.totalCirculatingUSD ?? row?.totalCirculating?.peggedUSD ?? row?.totalCirculating?.usd ?? null;
    const value = Number(raw);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) return null;
    return { ts, label: new Date(ts).toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit" }), value };
  }).filter(Boolean);
}

function normalizeMarketSeries(rows = []) {
  return normalizeLlamaOverviewChart(rows);
}

function normalizeLlamaOverviewChart(rows = []) {
  return (rows || []).map((row) => {
    const rawTs = Array.isArray(row) ? Number(row[0]) : null;
    const ts = Number.isFinite(rawTs) ? (rawTs < 1e12 ? rawTs * 1000 : rawTs) : null;
    const value = Array.isArray(row) ? Number(row[1]) : null;
    if (!Number.isFinite(ts) || !Number.isFinite(value)) return null;
    return { ts, label: new Date(ts).toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit" }), value };
  }).filter(Boolean);
}

function sanitizeSeries(series = [], { trimLeadingZeroes = false } = {}) {
  if (!Array.isArray(series) || !series.length) return [];
  const dedupMap = new Map();
  series.forEach((point) => {
    const ts = Number(point?.ts);
    const value = Number(point?.value);
    if (!Number.isFinite(ts) || !Number.isFinite(value)) return;
    dedupMap.set(ts, { ...point, ts, value });
  });
  const sorted = Array.from(dedupMap.values()).sort((a, b) => a.ts - b.ts);
  if (!sorted.length) return [];
  let firstValidIndex = 0;
  if (trimLeadingZeroes) {
    firstValidIndex = sorted.findIndex((point) => point.value > 0);
    if (firstValidIndex < 0) return [];
  }
  return sorted.slice(firstValidIndex).map((point) => ({
    ...point,
    label: new Date(point.ts).toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit" }),
  }));
}

function formatAxisValue(value) {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1e3) return formatCompactNumber(value, 1);
  if (abs >= 100) return `${Math.round(value)}`;
  if (abs >= 1) return `${value.toFixed(1)}`;
  return `${value.toFixed(2)}`;
}

function showChartEmpty(canvasId, message) {
  const wrap = document.getElementById(`${canvasId}-wrap`);
  if (!wrap) return;
  const existing = wrap.querySelector(".empty-chart");
  if (existing) existing.remove();
  const empty = document.createElement("div");
  empty.className = "empty-chart";
  empty.textContent = message;
  wrap.appendChild(empty);
}

function clearChartEmpty(canvasId) {
  const existing = document.getElementById(`${canvasId}-wrap`)?.querySelector(".empty-chart");
  if (existing) existing.remove();
}

function mergeSeriesByTimestamp(datasets) {
  const tsSet = new Set();
  datasets.forEach((dataset) => (dataset.series || []).forEach((point) => { if (Number.isFinite(point.ts)) tsSet.add(point.ts); }));
  const timestamps = Array.from(tsSet).sort((a, b) => a - b);
  const prepared = datasets.filter((dataset) => dataset.series?.length).map((dataset, index) => {
    const map = new Map(dataset.series.map((point) => [point.ts, point.value]));
    const color = dataset.color || (index ? "#8bb4ff" : "#65a0ff");
    return { label: dataset.label, data: timestamps.map((ts) => map.has(ts) ? map.get(ts) : null), borderColor:color, backgroundColor:`${color}24`, borderWidth:2, tension:.2, pointRadius:0, pointHoverRadius:4, pointHitRadius:12, spanGaps:true, fill:"origin", yAxisID:dataset.yAxisID || "y", hidden:!!dataset.hidden };
  });
  return { timestamps, prepared };
}

function timelineLabel(ts, compact = false) {
  const date = new Date(ts);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ru-RU", compact ? { month:"short", year:"2-digit" } : { year:"numeric" }).format(date);
}

function dashboardChartOptions(timestamps, { prefix = "$", suffix = "" } = {}) {
  return {
    responsive:true, maintainAspectRatio:false, animation:{ duration:500 }, interaction:{ intersect:false, mode:"index" },
    layout:{ padding:{ top:8, right:8, bottom:2, left:2 } },
    plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:"rgba(13,17,25,.96)", borderColor:"rgba(134,172,255,.28)", borderWidth:1, padding:12, titleColor:"#a8b2c7", bodyColor:"#f4f7ff", displayColors:false, callbacks:{ title(items){ return items.length ? new Date(timestamps[items[0].dataIndex]).toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" }) : ""; }, label(context){ return context.parsed.y == null ? `${context.dataset.label}: —` : `${context.dataset.label}: ${prefix}${formatAxisValue(context.parsed.y)}${suffix}`; } } } },
    scales:{
      x:{ offset:false, ticks:{ color:"#8490a7", maxTicksLimit:7, maxRotation:0, autoSkip:true, callback(value){ const ts=timestamps[Number(value)]; const years=(timestamps.at(-1)-timestamps[0])/31557600000; return timelineLabel(ts, years < 2); } }, grid:{ display:false }, border:{ display:false } },
      y:{ beginAtZero:true, grace:"6%", ticks:{ color:"#8490a7", maxTicksLimit:5, padding:10, callback(value){ return `${prefix}${formatAxisValue(Number(value))}${suffix}`; } }, grid:{ color:"rgba(255,255,255,.055)", drawTicks:false }, border:{ display:false } }
    }
  };
}

function createDashboardChart(canvasId, series, label, { color = "#65a0ff", prefix = "$", suffix = "" } = {}) {
  const el = document.getElementById(canvasId);
  if (!el || !series?.length) { showChartEmpty(canvasId, "Данные временно недоступны"); return null; }
  const normalized = [...series].filter((point) => Number.isFinite(point.ts) && Number.isFinite(point.value)).sort((a, b) => a.ts - b.ts);
  if (!normalized.length) { showChartEmpty(canvasId, "Данные временно недоступны"); return null; }
  clearChartEmpty(canvasId);
  const chart = new Chart(el, { type:"line", data:{ labels:[], datasets:[] }, options:dashboardChartOptions([]) });
  const startInput = document.querySelector(`#${canvasId}-navigator .navigator-start`);
  const endInput = document.querySelector(`#${canvasId}-navigator .navigator-end`);
  const navigator = document.getElementById(`${canvasId}-navigator`);
  const maxIndex = normalized.length - 1;
  [startInput, endInput].forEach((input) => { input.max = String(maxIndex); });

  const render = (start, end, rangeLabel = "Выбранный диапазон") => {
    start = Math.max(0, Math.min(start, maxIndex));
    end = Math.max(start, Math.min(end, maxIndex));
    startInput.value = String(start); endInput.value = String(end);
    navigator?.style.setProperty("--range-start", `${maxIndex ? start / maxIndex * 100 : 0}%`);
    navigator?.style.setProperty("--range-end", `${maxIndex ? end / maxIndex * 100 : 100}%`);
    const visible = normalized.slice(start, end + 1);
    const { timestamps, prepared } = mergeSeriesByTimestamp([{ label, series:visible, color }]);
    chart.data.labels = timestamps; chart.data.datasets = prepared;
    chart.options = dashboardChartOptions(timestamps, { prefix, suffix }); chart.update("none");
    const rangeNode = document.getElementById(`${canvasId}-range-label`);
    if (rangeNode) rangeNode.textContent = rangeLabel;
  };
  const indexForDate = (timestamp) => { const index = normalized.findIndex((point) => point.ts >= timestamp); return index < 0 ? 0 : index; };
  const applyPreset = (range) => {
    const last = normalized[maxIndex].ts;
    const date = new Date(last);
    let start = 0;
    if (range === "ALL") start = 0;
    if (range === "1M") start = indexForDate(last - 31 * 86400000);
    if (range === "3M") start = indexForDate(last - 92 * 86400000);
    if (range === "6M") start = indexForDate(last - 183 * 86400000);
    if (range === "1Y") start = indexForDate(last - 365 * 86400000);
    if (range === "YTD") start = indexForDate(Date.UTC(date.getUTCFullYear(), 0, 1));
    document.querySelectorAll(`[data-chart="${canvasId}"]`).forEach((button) => button.classList.toggle("active", button.dataset.range === range));
    render(start, maxIndex, range);
  };
  document.querySelectorAll(`[data-chart="${canvasId}"]`).forEach((button) => button.addEventListener("click", () => applyPreset(button.dataset.range)));
  const onNavigatorInput = (event) => {
    let start = Number(startInput.value); let end = Number(endInput.value);
    if (start >= end) { if (event.target === startInput) start = Math.max(0, end - 1); else end = Math.min(maxIndex, start + 1); }
    document.querySelectorAll(`[data-chart="${canvasId}"]`).forEach((button) => button.classList.remove("active"));
    render(start, end);
  };
  startInput?.addEventListener("input", onNavigatorInput); endInput?.addEventListener("input", onNavigatorInput);
  applyPreset(DEFAULT_CHART_RANGE);
  return chart;
}

function createDashboardMultiChart(canvasId, datasets) {
  const el = document.getElementById(canvasId);
  const normalized = datasets.map((dataset) => ({ ...dataset, series:sanitizeSeries(normalizeMarketSeries(dataset.series)) })).filter((dataset) => dataset.series.length);
  if (!el || normalized.length < 2) { showChartEmpty(canvasId, "Данные временно недоступны"); return null; }
  const timestamps = [...new Set(normalized.flatMap((dataset) => dataset.series.map((point) => point.ts)))].sort((a, b) => a - b);
  const chart = new Chart(el, { type:"line", data:{ labels:[], datasets:[] }, options:dashboardChartOptions([]) });
  const render = (range = "ALL") => {
    const last = timestamps.at(-1); const date = new Date(last); let start = 0;
    if (range === "1M") start = last - 31 * 86400000;
    if (range === "3M") start = last - 92 * 86400000;
    if (range === "6M") start = last - 183 * 86400000;
    if (range === "1Y") start = last - 365 * 86400000;
    if (range === "YTD") start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const visible = normalized.map((dataset) => ({ ...dataset, series:dataset.series.filter((point) => !start || point.ts >= start) }));
    const merged = mergeSeriesByTimestamp(visible);
    chart.data.labels = merged.timestamps; chart.data.datasets = merged.prepared;
    chart.options = dashboardChartOptions(merged.timestamps); chart.options.plugins.legend.display = true; chart.update("none");
    const label = document.getElementById(`${canvasId}-range-label`); if (label) label.textContent = range;
    document.querySelectorAll(`[data-chart="${canvasId}"]`).forEach((button) => button.classList.toggle("active", button.dataset.range === range));
  };
  document.querySelectorAll(`[data-chart="${canvasId}"]`).forEach((button) => button.addEventListener("click", () => render(button.dataset.range)));
  document.getElementById(`${canvasId}-navigator`)?.remove();
  render(); return chart;
}

function technicalBiasHtml(bias) {
  const groups = [
    { chips: ["1m","3m","5m"], note: bias?.notes?.lower_tf || "—" },
    { chips: ["15m","1h","4h"], note: bias?.notes?.mid_tf || "—" },
    { chips: ["1d","1w","1M"], note: bias?.notes?.higher_tf || "—" },
  ];

  const groupsHtml = groups.map((group) => {
    const chipsHtml = group.chips.map((tf) => {
      const state = bias?.timeframes?.[tf] || "neutral";
      return `<div class="bias-chip ${escapeHtml(state)}">${tf} <span class="bias-dot"></span></div>`;
    }).join("");
    return `<div class="ta-group"><div class="ta-group-chips">${chipsHtml}</div><div class="list-item">${escapeHtml(group.note)}</div></div>`;
  }).join("");

  return `<section class="panel"><div class="section-title">Быстрый теханализ</div><div class="section-sub">Краткая оценка структуры по ключевым таймфреймам</div><div class="ta-meta-row"><div class="ta-meta-box"><div class="metric-title">Источник</div><div class="ta-meta-value">${escapeHtml(bias?.source || "—")}</div></div><div class="ta-meta-box"><div class="metric-title">Обновлено</div><div class="ta-meta-value">${bias?.updated_at ? new Date(bias.updated_at).toLocaleString("ru-RU") : "—"}</div></div></div><div class="ta-groups">${groupsHtml}</div></section>`;
}

function buildUsersStatusCard(metrics) {
  const status = metrics?.daily_active_addresses?.status || "partial";
  return `<div class="list-item"><strong>Статус данных</strong><br>${statusChip(status)}<div class="metric-status-line">Надежный актуальный источник пользовательских метрик пока недоступен. Блок обновится автоматически после подключения.</div></div>`;
}

function loadTradingViewScript() {
  return new Promise((resolve, reject) => {
    if (window.TradingView) return resolve();
    const existing = document.querySelector('script[data-tv-script="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once:true });
      existing.addEventListener("error", () => reject(new Error("TradingView script failed")), { once:true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.dataset.tvScript = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("TradingView script failed"));
    document.head.appendChild(script);
  });
}

async function initTradingView(symbol) {
  const container = document.getElementById("tv-widget");
  if (!container) return;
  try {
    await loadTradingViewScript();
    if (!window.TradingView) return;
    container.innerHTML = "";
    new window.TradingView.widget({
      autosize:true, symbol, interval:"D", timezone:"Etc/UTC", theme:"dark", style:"1", locale:"ru",
      enable_publishing:false, hide_side_toolbar:false, allow_symbol_change:true, container_id:"tv-widget"
    });
  } catch {
    container.innerHTML = `<div class="error-box">TradingView не загрузился</div>`;
  }
}

function reportStateHtml(kind, title, message, { retry = false } = {}) {
  const spinner = kind === "loading" ? `<span class="state-spinner" aria-hidden="true"></span>` : "";
  const retryAction = retry ? `<button class="state-link state-retry" type="button" data-report-retry>Повторить загрузку</button>` : "";
  const otherAction = kind === "loading" ? "" : `<a class="state-link" href="/">Выбрать другой проект</a>`;
  const actions = retryAction || otherAction ? `<div class="state-actions">${retryAction}${otherAction}</div>` : "";
  return `<div class="report-state ${kind === "loading" ? "loading-state" : "error-state"}">${spinner}<div><strong>${escapeHtml(title)}</strong><span class="state-message">${escapeHtml(message)}</span></div>${actions}</div>`;
}

function setReportState(app, kind, title, message, options = {}) {
  app.innerHTML = reportStateHtml(kind, title, message, options);
  app.querySelector("[data-report-retry]")?.addEventListener("click", () => loadReport());
}

const REPORT_CACHE_TTL_MS = 15 * 60 * 1000;
const REPORT_RETRY_DELAYS_MS = [500, 1200];
let reportLoadGeneration = 0;
let activeReportController = null;

function cachedReport(slug) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(`report:${slug}`));
    return cached && Date.now() - cached.storedAt <= REPORT_CACHE_TTL_MS ? cached.data : null;
  } catch { return null; }
}

function storeReport(slug, data) {
  try { sessionStorage.setItem(`report:${slug}`, JSON.stringify({ storedAt:Date.now(), data })); } catch { /* storage is best-effort */ }
}

function isTemporaryReportStatus(status) { return status === 408 || status === 425 || status === 429 || status >= 500; }
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function fetchReportAttempt(slug, timeoutMs = 25_000) {
  const controller = new AbortController();
  activeReportController = controller;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/report/${encodeURIComponent(slug)}`, { cache:"default", signal:controller.signal });
    let data = null;
    try { data = await response.json(); } catch { /* handled as a temporary invalid response */ }
    return { response, data };
  } finally {
    clearTimeout(timer);
    if (activeReportController === controller) activeReportController = null;
  }
}

async function fetchReportWithRetry(slug, onAttempt, isActive) {
  let lastFailure;
  for (let attempt = 0; attempt <= REPORT_RETRY_DELAYS_MS.length; attempt += 1) {
    if (!isActive()) throw new DOMException("Superseded report load", "AbortError");
    if (attempt > 0) {
      onAttempt(attempt + 1);
      await wait(REPORT_RETRY_DELAYS_MS[attempt - 1]);
    }
    try {
      const result = await fetchReportAttempt(slug);
      if (result.response.ok && result.data?.meta?.readiness?.state === "ready") {
        storeReport(slug, result.data);
        return { ...result, fromCache:false };
      }
      if (result.response.ok) lastFailure = result;
      else if (!isTemporaryReportStatus(result.response.status)) return { ...result, fromCache:false };
      else lastFailure = result;
    } catch (error) { lastFailure = { error }; }
  }
  const fallback = cachedReport(slug);
  if (fallback) return { response:{ ok:true, status:200 }, data:fallback, fromCache:true };
  if (lastFailure?.response) return { ...lastFailure, fromCache:false };
  throw lastFailure?.error || new Error("Report request failed");
}

async function loadReport() {
  const loadGeneration = ++reportLoadGeneration;
  activeReportController?.abort();
  const isActive = () => loadGeneration === reportLoadGeneration;
  injectEnhancementStyles();
  const slug = getSlug();
  const app = document.getElementById("app");
  const reportSearch = document.getElementById("report-project-search");
  if (reportSearch) reportSearch.value = slug.toUpperCase();
  const loadingPhases = [
    "Загружаем отчет и определяем профиль проекта.",
    "Собираем данные по проекту.",
    "Это занимает больше времени, чем обычно…",
  ];
  let phaseIndex = 0;
  app.setAttribute("aria-busy", "true");
  setReportState(app, "loading", `Собираем отчет по ${slug.toUpperCase()}…`, loadingPhases[phaseIndex]);
  const phaseTimer = setInterval(() => {
    phaseIndex = Math.min(phaseIndex + 1, loadingPhases.length - 1);
    setReportState(app, "loading", `Собираем отчет по ${slug.toUpperCase()}…`, loadingPhases[phaseIndex], { retry:phaseIndex === loadingPhases.length - 1 });
  }, 3500);

  try {
    const { response:res, data, fromCache } = await fetchReportWithRetry(slug, (attempt) => {
      if (isActive()) setReportState(app, "loading", `Повторяем попытку загрузки (${attempt}/3)…`, "Временная ошибка источника — отчет продолжает собираться.", { retry:true });
    }, isActive);
    if (!isActive()) return;
    if (!res.ok) {
      if (res.status === 404) {
        setReportState(app, "error", "Проект не найден", "Проверьте тикер или slug и попробуйте другой проект.", { retry:false });
      } else {
        setReportState(app, "error", "Не удалось собрать отчет", "Автоматические попытки исчерпаны. Можно повторить загрузку без обновления страницы.", { retry:true });
      }
      return;
    }
    if (data?.meta?.readiness?.state !== "ready") {
      setReportState(app, "error", "Отчет временно недоступен", "Источники не вернули критические данные после повторных попыток.", { retry:true });
      return;
    }
    if (fromCache) data.meta.data_status = `${data.meta.data_status || "report"}-cached-fallback`;

    const tradingViewSymbol = data?.meta?.market_symbols?.tradingView || null;
    app.innerHTML = `<div class="layout"><aside class="sidebar-card project-sidebar"><div class="sidebar-identity"><div class="sidebar-project-mark">${projectIconHtml(data.meta, true)}<div class="project-main">${escapeHtml(data.meta.project_name)}</div></div><span class="project-ticker">${escapeHtml(data.meta.ticker)}</span></div><div class="tag-row">${(data.meta.categories || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div><div class="sidebar-meta"><span>Обновлено</span><strong>${new Date(data.meta.updated_at).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" })}</strong></div></aside><main class="content">
      <section class="panel hero-overview"><div class="hero-heading">${projectIconHtml(data.meta)}<div class="hero-identity"><div class="hero-title-row"><h1>${escapeHtml(data.meta.project_name || data.hero.title)}</h1><span class="hero-ticker">${escapeHtml(data.meta.ticker)}</span></div>${data.hero.subtitle && data.hero.subtitle !== data.meta.ticker ? `<div class="subtitle">${escapeHtml(data.hero.subtitle)}</div>` : ""}</div></div><p class="lead hero-lead">${escapeHtml(data.hero.lead)}</p>
      <div class="hero-grid hero-kpis">${heroKpisHtml(data)}</div>
      <div class="three-col hero-thesis top-gap"><div class="list-item"><strong>Главная сила</strong><span>${escapeHtml(data.hero.main_strength || "—")}</span></div><div class="list-item"><strong>Главный риск</strong><span>${escapeHtml(data.hero.main_risk || "—")}</span></div><div class="list-item"><strong>Что проверить</strong><span>${escapeHtml(data.hero.status_text || "—")}</span></div></div></section>
      ${tradingViewCard(tradingViewSymbol)}
      ${marketPackHtml(data)}
      ${technicalBiasHtml(data.technical_bias)}
      ${data.meta?.features?.hideExecutiveSummary ? "" : `<section class="panel executive-summary"><div class="section-title">Кратко для инвестора</div><div class="section-sub">Три проверки качества инвестиционного тезиса.</div><div class="list-wrap">${listHtml(data.executive_summary?.items)}</div></section>`}
      ${orderedReportSectionsHtml(data)}
    </main></div>`;

    const tvlSeriesRaw = sanitizeSeries(normalizeLlamaSeries(data?.charts?.tvl_history, "totalLiquidityUSD"), { trimLeadingZeroes:true });
    const stableSeriesRaw = sanitizeSeries(normalizeLlamaSeries(data?.charts?.stablecoins_history, "totalCirculatingUSD"), { trimLeadingZeroes:true });
    const tvlSeries = sanitizeSeries(tvlSeriesRaw, { trimLeadingZeroes:true });
    const stableSeries = sanitizeSeries(stableSeriesRaw, { trimLeadingZeroes:true });
    const appFeesSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.app_fees_history), { trimLeadingZeroes:true });
    const chainFeesSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.chain_fees_history), { trimLeadingZeroes:true });
    const dexSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.dex_history), { trimLeadingZeroes:true });
    const volumeHistorySeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.volume_history), { trimLeadingZeroes:true });
    const marketCapHistorySeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.market_cap_history), { trimLeadingZeroes:true });
    const mvrvSeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.mvrv_history));
    const realizedPriceSeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.realized_price_history));
    const btcMarketPriceSeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.btc_market_price_history));
    const issuanceSeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.issuance_history));
    const btcEtfFlowSeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.btc_etf_flow_history));
    const btcEtfCumulativeSeries = sanitizeSeries(normalizeMarketSeries(data?.charts?.btc_etf_cumulative_history));

    createDashboardChart("volumeHistoryChart", volumeHistorySeries, "Объем торгов", { color:"#60a5fa" });
    createDashboardChart("marketCapHistoryChart", marketCapHistorySeries, "Рыночная капитализация", { color:"#a78bfa" });
    createDashboardChart("appFeesChart", appFeesSeries, "App Fees", { color:"#a78bfa" });
    createDashboardChart("chainFeesChart", chainFeesSeries, "Chain Fees", { color:"#f59e80" });
    createDashboardChart("dexChart", dexSeries, "DEX Volume", { color:"#60a5fa" });
    createDashboardChart("tvlChart", tvlSeries, "TVL", { color:"#65a0ff" });
    createDashboardChart("stableChart", stableSeries, "Stablecoins", { color:"#55d6a5" });
    createDashboardChart("mvrvChart", mvrvSeries, "MVRV", { color:"#f7931a", prefix:"", suffix:"x" });
    createDashboardMultiChart("realizedPriceChart", [
      { label:"Market Price", series:btcMarketPriceSeries, color:"#f7931a" },
      { label:"Realized Price", series:realizedPriceSeries, color:"#65a0ff" },
    ]);
    createDashboardChart("btcEtfFlowChart", btcEtfFlowSeries, "Spot BTC ETF Net Flow", { color:"#55d6a5" });
    createDashboardChart("btcEtfCumulativeChart", btcEtfCumulativeSeries, "Spot BTC ETF Cumulative Flow", { color:"#65a0ff" });
    createDashboardChart("issuanceChart", issuanceSeries, "Годовой темп эмиссии", { color:"#55d6a5", prefix:"", suffix:"%" });
    if (tradingViewSymbol) initTradingView(tradingViewSymbol);
  } catch (error) {
    if (!isActive()) return;
    const message = error?.name === "AbortError"
      ? "Источники не успели вернуть критические данные за отведенное время. Попробуйте еще раз позже."
      : "Проверьте соединение и попробуйте еще раз.";
    setReportState(app, "error", "Не удалось загрузить отчет", message, { retry:true });
  } finally {
    clearInterval(phaseTimer);
    if (isActive()) app.removeAttribute("aria-busy");
  }
}

loadReport();
