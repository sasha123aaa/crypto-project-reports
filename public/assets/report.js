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
  "Stablecoins Mcap": "Общий объем стейблкоинов внутри сети.",
  "Chain Fees 24h": "Сумма сетевых комиссий за последние 24 часа.",
  "DEX Volume 24h": "Объем торгов на децентрализованных биржах внутри сети за 24 часа.",
  "Объем 24ч / капитализация": "Показывает, какой процент от рыночной капитализации составил суточный объем торгов.",
  "RWA Active Mcap": "Активная рыночная капитализация токенизированных реальных активов в сети по данным DefiLlama.",
  "Market Cap / TVL": "Сравнение капитализации актива с капиталом внутри сети.",
  "Stablecoins / TVL": "Отношение объема стейблкоинов в сети к TVL.",
  "Circulating Supply": "Количество монет, которые реально находятся в обращении.",
  "Total Supply": "Общее текущее предложение монет.",
  "Max Supply": "Максимально возможное предложение, если оно существует.",
  "Net Issuance": "Чистое изменение предложения после выпуска новых монет и сжигания.",
  "Burn Mechanism": "Механизм сжигания или изъятия части предложения из оборота.",
  "Market Buyback": "Наличие или отсутствие классического выкупа токена с рынка.",
  "Daily Active Addresses": "Количество активных адресов за день.",
  "New Addresses": "Количество новых адресов за период.",
  "Transactions": "Количество транзакций за период.",
  "Статус оценки": "Краткая качественная оценка текущей стадии актива."
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
    .status-chip{display:inline-flex;align-items:center;justify-content:center;min-width:68px;padding:6px 10px;border-radius:999px;font-size:11px;font-weight:800;letter-spacing:.08em;border:1px solid var(--line);background:rgba(255,255,255,.04);color:#dce6ff}
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
  const labelMap = { live:"LIVE", static:"STATIC", manual:"MANUAL", calculated:"CALC", partial:"PARTIAL", unavailable:"N/A", unknown:"UNKNOWN" };
  const titleMap = {
    live:"Получено из актуального внешнего источника.",
    static:"Структурная характеристика протокола. Не требует регулярного обновления.",
    calculated:"Рассчитано автоматически на основе актуальных данных.",
    partial:"Доступна только часть актуальных данных.",
    unavailable:"Данные временно недоступны.",
    manual:"Заполнено вручную и требует периодической проверки.",
  };
  return `<span class="status-chip ${escapeHtml(status)}" title="${escapeHtml(titleMap[status] || "Статус данных")}">${labelMap[status] || status.toUpperCase()}</span>`;
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

function usersSectionHtml(report) {
  if (!shouldRenderSection(report, "users_and_activity") || !shouldRenderUsersBlock(report)) return "";
  const users = report?.users || {};
  const metrics = users.metrics || {};
  const text = Array.isArray(users.text) ? users.text : [];
  return `<section class="panel"><div class="section-title">${escapeHtml(users.title || "Активность пользователей")}</div>${text.map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid">${metricHtml("Daily Active Addresses", metrics.daily_active_addresses)}${metricHtml("New Addresses", metrics.new_addresses)}${metricHtml("Transactions", metrics.transactions)}</div>${hasNoLiveUsers(metrics) ? `<div class="three-col top-gap">${buildUsersStatusCard(metrics)}</div>` : ""}</section>`;
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

function metricHtml(title, metric) {
  const help = METRIC_HELP[title]
    ? `<span class="info-wrap"><span class="info-icon">i</span><span class="tooltip">${escapeHtml(METRIC_HELP[title])}</span></span>`
    : "";
  const freshness = metric?.updated_at ? ` · ${escapeHtml(formatShortDate(metric.updated_at))}` : "";
  const valueClass = String(metricFormattedValue(metric)).length > 18 ? " metric-value-long" : "";
  return `<div class="metric-box"><div class="metric-top-row"><div class="metric-title">${escapeHtml(title)} ${help}</div>${statusChip(metric?.status || "unknown")}</div><div class="metric-value${valueClass}">${escapeHtml(metricFormattedValue(metric))}</div><div class="metric-status-line">${escapeHtml(metric?.source || "—")}${freshness}</div></div>`;
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
function ethereumIconHtml(ticker) {
  if (String(ticker).toUpperCase() !== "ETH") return `<span class="hero-token-fallback">${escapeHtml(ticker || "")}</span>`;
  return `<span class="eth-icon" aria-label="Ethereum"><svg viewBox="0 0 256 417" role="img" aria-hidden="true"><path class="eth-top-left" d="M127.9 0L125.1 9.5v274.2l2.8 2.8 127.9-75.6z"/><path class="eth-top-right" d="M127.9 0L0 210.9l127.9 75.6V154.1z"/><path class="eth-bottom-left" d="M127.9 310.7l-1.6 1.9v98.2l1.6 4.7 128-180.3z"/><path class="eth-bottom-right" d="M127.9 415.5V310.7L0 235.2z"/><path class="eth-center-left" d="M127.9 286.5l127.9-75.6-127.9-56.8z"/><path class="eth-center-right" d="M0 210.9l127.9 75.6V154.1z"/></svg></span>`;
}
function newsHtml(news = {}, report = {}) {
  if (!shouldRenderSection(report, "narrative_and_news")) return "";
  const items = Array.isArray(news.items) ? news.items : [];
  const body = items.length ? `<div class="news-list">${items.map((item) => `<a class="news-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><div class="news-meta"><span class="news-source">${escapeHtml(item.source || news.source || "Источник")}</span><span class="news-date">${escapeHtml(formatShortDate(item.date))}</span></div><h3>${escapeHtml(item.title)}</h3>${item.snippet ? `<p>${escapeHtml(item.snippet)}</p>` : ""}</a>`).join("")}</div>` : `<div class="news-empty">Свежие новости временно недоступны</div>`;
  const freshness = news.updated_at ? `Обновлено ${new Date(news.updated_at).toLocaleString("ru-RU")}` : "Live-лента";
  return `<section class="panel news-section"><div class="section-title">Последние новости</div><div class="section-sub">Свежие новости проекта и крипторынка · ${escapeHtml(freshness)}</div>${body}</section>`;
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
  return `<div class="list-item section-insight top-gap"><strong>Вывод</strong><span>${escapeHtml(conclusion)}</span></div>`;
}

function insightPanelHtml(block = {}) {
  const conclusion = block?.conclusion;
  if (!conclusion) return "";
  return `<section class="panel compact-panel"><div class="status-banner-row"><div><div class="status-banner-title">Вывод по данным</div><div class="status-banner-text">${escapeHtml(conclusion)}</div></div></div></section>`;
}

function chartCard(id, title, subtitle = "", controlsHtml = "", note = "") {
  return `<section class="panel"><div class="chart-head"><div><div class="section-title">${escapeHtml(title)}</div>${subtitle ? `<div class="section-sub">${escapeHtml(subtitle)}</div>` : ""}</div>${controlsHtml ? `<div class="chart-controls">${controlsHtml}</div>` : ""}</div>${note ? `<div class="chart-note">${escapeHtml(note)}</div>` : ""}<div class="chart-shell" id="${id}-wrap"><canvas id="${id}"></canvas></div></section>`;
}

function tradingViewCard() {
  return `<section class="panel"><div class="section-title">Живой график TradingView</div><div class="section-sub">Интерактивный график для детального просмотра цены и структуры рынка</div><div class="tv-shell"><div id="tv-widget" style="width:100%;height:100%;"></div></div></section>`;
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

function dashboardChartOptions(timestamps) {
  return {
    responsive:true, maintainAspectRatio:false, animation:{ duration:500 }, interaction:{ intersect:false, mode:"index" },
    layout:{ padding:{ top:8, right:8, bottom:2, left:2 } },
    plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:"rgba(13,17,25,.96)", borderColor:"rgba(134,172,255,.28)", borderWidth:1, padding:12, titleColor:"#a8b2c7", bodyColor:"#f4f7ff", displayColors:false, callbacks:{ title(items){ return items.length ? new Date(timestamps[items[0].dataIndex]).toLocaleDateString("ru-RU", { day:"numeric", month:"long", year:"numeric" }) : ""; }, label(context){ return context.parsed.y == null ? `${context.dataset.label}: —` : `${context.dataset.label}: $${formatAxisValue(context.parsed.y)}`; } } } },
    scales:{
      x:{ offset:false, ticks:{ color:"#8490a7", maxTicksLimit:7, maxRotation:0, autoSkip:true, callback(value){ const ts=timestamps[Number(value)]; const years=(timestamps.at(-1)-timestamps[0])/31557600000; return timelineLabel(ts, years < 2); } }, grid:{ display:false }, border:{ display:false } },
      y:{ beginAtZero:true, grace:"6%", ticks:{ color:"#8490a7", maxTicksLimit:5, padding:10, callback(value){ return `$${formatAxisValue(Number(value))}`; } }, grid:{ color:"rgba(255,255,255,.055)", drawTicks:false }, border:{ display:false } }
    }
  };
}

function createDashboardChart(canvasId, series, label, { color = "#65a0ff" } = {}) {
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
    chart.options = dashboardChartOptions(timestamps); chart.update("none");
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
  return `<div class="list-item"><strong>Статус данных</strong><br>${statusChip(status)}<div class="metric-status-line">Надежный live-источник пользовательских метрик пока недоступен. Блок обновится автоматически после подключения.</div></div>`;
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

async function loadReport() {
  injectEnhancementStyles();
  const slug = getSlug();
  const app = document.getElementById("app");

  try {
    const res = await fetch(`/api/report/${slug}`, { cache:"no-store", headers:{ "cache-control":"no-cache" } });
    const data = await res.json();
    if (!res.ok) {
      app.innerHTML = `<div class="error-box">Ошибка: ${escapeHtml(data.error || "не удалось загрузить отчет")}</div>`;
      return;
    }

    const tvSymbolMap = { eth:"BINANCE:ETHUSDT", sol:"BINANCE:SOLUSDT", link:"BINANCE:LINKUSDT" };
    app.innerHTML = `<div class="layout"><aside class="sidebar-card project-sidebar"><div class="sidebar-identity"><div class="project-main">${escapeHtml(data.meta.project_name)}</div><span class="project-ticker">${escapeHtml(data.meta.ticker)}</span></div><div class="tag-row">${(data.meta.categories || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div><div class="sidebar-meta"><span>Обновлено</span><strong>${new Date(data.meta.updated_at).toLocaleDateString("ru-RU", { day:"2-digit", month:"long", year:"numeric" })}</strong></div></aside><main class="content">
      <section class="panel hero-overview"><div class="hero-heading">${ethereumIconHtml(data.meta.ticker)}<div class="hero-identity"><div class="hero-title-row"><h1>${escapeHtml(data.meta.project_name || data.hero.title)}</h1><span class="hero-ticker">${escapeHtml(data.meta.ticker)}</span></div>${data.hero.subtitle && data.hero.subtitle !== data.meta.ticker ? `<div class="subtitle">${escapeHtml(data.hero.subtitle)}</div>` : ""}</div></div><p class="lead hero-lead">${escapeHtml(data.hero.lead)}</p>
      <div class="hero-grid hero-kpis">${metricHtml("Цена", data.market.price)}${metricHtml("Рыночная капитализация", data.market.market_cap)}${metricHtml("FDV", data.market.fdv)}${metricHtml("Объем 24ч", data.market.volume_24h)}${metricHtml("TVL", data.capital.metrics.tvl)}${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}</div>
      <div class="three-col hero-thesis top-gap"><div class="list-item"><strong>Главная сила</strong><span>${escapeHtml(data.hero.main_strength || "—")}</span></div><div class="list-item"><strong>Главный риск</strong><span>${escapeHtml(data.hero.main_risk || "—")}</span></div><div class="list-item"><strong>Общий статус</strong><span>${escapeHtml(data.hero.status_text || "—")}</span></div></div></section>
      ${tradingViewCard()}
      ${technicalBiasHtml(data.technical_bias)}
      ${data.meta?.features?.hideExecutiveSummary ? "" : `<section class="panel"><div class="section-title">Executive Summary</div><div class="list-wrap">${listHtml(data.executive_summary?.items)}</div></section>`}
      ${shouldRenderSection(data, "tokenomics") ? `<section class="panel section-flow tokenomics-section"><div class="section-title">Токеномика</div><div class="section-sub">Баланс предложения, выпуска и сжигания ETH</div><div class="hero-grid">${metricHtml("Market Cap", data.tokenomics.metrics.market_cap)}${metricHtml("FDV", data.tokenomics.metrics.fdv)}${metricHtml("Circulating Supply", data.tokenomics.metrics.circulating_supply)}${metricHtml("Total Supply", data.tokenomics.metrics.total_supply)}${metricHtml("Max Supply", data.tokenomics.metrics.max_supply)}${optionalMetricHtml("Net Issuance", data.tokenomics.metrics.net_issuance)}${optionalMetricHtml("Burn Mechanism", data.tokenomics.metrics.burn_mechanism)}${optionalMetricHtml("Market Buyback", data.tokenomics.metrics.market_buyback)}</div>${insightHtml(data.tokenomics)}</section>` : ""}
      ${shouldRenderSection(data, "financials") ? `<section class="panel section-flow finance-section"><div class="section-title">Финансы</div>${(data.financials.text || []).slice(0, 2).map((p) => `<p class="lead compact-lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid finance-kpis">${metricHtml("Chain Fees 24h", data.financials.metrics.chain_fees_24h)}${metricHtml("DEX Volume 24h", data.financials.metrics.dex_volume_24h)}${metricHtml("Объем 24ч / капитализация", data.financials.metrics.volume_market_cap)}</div><div class="financial-fee-charts">${compactChartHtml("appFeesChart", "App Fees", "Комиссии приложений внутри экосистемы")}${compactChartHtml("chainFeesChart", "Chain Fees", "Сетевые комиссии базового слоя")}</div><div class="chart-stack">${compactChartHtml("dexChart", "DEX-оборот", "On-chain торговая активность")}</div>${insightHtml(data.financials)}</section>` : ""}
      ${shouldRenderSection(data, "tvl_and_capital") ? `<section class="panel section-flow capital-section"><div class="section-title">TVL и капитал</div>${(data.capital.text || []).slice(0, 1).map((p) => `<p class="lead compact-lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid capital-kpis">${metricHtml("TVL", data.capital.metrics.tvl)}${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}${metricHtml("RWA Active Mcap", data.capital.metrics.rwa_active_mcap)}</div><div class="capital-charts">${compactChartHtml("tvlChart", "TVL", "Капитал в DeFi-слое")}${compactChartHtml("stableChart", "Stablecoins", "Расчетная ликвидность сети")}</div>${insightHtml(data.capital)}</section>` : ""}
      ${usersSectionHtml(data)}
      ${shouldRenderSection(data, "risks") || shouldRenderSection(data, "final_summary") ? `<section class="panel"><div class="section-title">Резюме</div><div class="columns-4 profile-grid"><div><h3>Сильные стороны</h3>${listHtml(data.profile.strengths)}</div><div><h3>Слабые стороны</h3>${listHtml(data.profile.weaknesses)}</div><div><h3>Риски</h3>${listHtml(data.profile.risks)}</div><div><h3>Что отслеживать</h3>${listHtml(data.profile.watch)}</div></div></section>` : ""}
      ${newsHtml(data.news, data)}
    </main></div>`;

    const tvlSeriesRaw = sanitizeSeries(normalizeLlamaSeries(data?.charts?.tvl_history, "totalLiquidityUSD"), { trimLeadingZeroes:true });
    const stableSeriesRaw = sanitizeSeries(normalizeLlamaSeries(data?.charts?.stablecoins_history, "totalCirculatingUSD"), { trimLeadingZeroes:true });
    const tvlSeries = sanitizeSeries(tvlSeriesRaw, { trimLeadingZeroes:true });
    const stableSeries = sanitizeSeries(stableSeriesRaw, { trimLeadingZeroes:true });
    const appFeesSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.app_fees_history), { trimLeadingZeroes:true });
    const chainFeesSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.chain_fees_history), { trimLeadingZeroes:true });
    const dexSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.dex_history), { trimLeadingZeroes:true });

    createDashboardChart("appFeesChart", appFeesSeries, "App Fees", { color:"#a78bfa" });
    createDashboardChart("chainFeesChart", chainFeesSeries, "Chain Fees", { color:"#f59e80" });
    createDashboardChart("dexChart", dexSeries, "DEX Volume", { color:"#60a5fa" });
    createDashboardChart("tvlChart", tvlSeries, "TVL", { color:"#65a0ff" });
    createDashboardChart("stableChart", stableSeries, "Stablecoins", { color:"#55d6a5" });
    initTradingView(tvSymbolMap[slug] || "BINANCE:ETHUSDT");
  } catch (error) {
    app.innerHTML = `<div class="error-box">Ошибка загрузки: ${escapeHtml(error.message)}</div>`;
  }
}

loadReport();
