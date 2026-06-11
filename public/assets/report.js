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

function shouldRenderUsersBlock(report) {
  const explicitRule = report?.meta?.features?.usersBlock;
  if (explicitRule === true) return true;
  if (explicitRule === false) return false;
  return !!report?.users;
}

function usersSectionHtml(report) {
  if (!shouldRenderUsersBlock(report)) return "";
  const users = report?.users || {};
  const metrics = users.metrics || {};
  const text = Array.isArray(users.text) ? users.text : [];
  return `<section class="panel"><div class="section-title">${escapeHtml(users.title || "Активность пользователей")}</div>${text.map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid">${metricHtml("Daily Active Addresses", metrics.daily_active_addresses)}${metricHtml("New Addresses", metrics.new_addresses)}${metricHtml("Transactions", metrics.transactions)}</div>${hasNoLiveUsers(metrics) ? `<div class="three-col top-gap">${buildUsersStatusCard(metrics)}</div>` : ""}</section>`;
}

function metricHtml(title, metric) {
  const help = METRIC_HELP[title]
    ? `<span class="info-wrap"><span class="info-icon">i</span><span class="tooltip">${escapeHtml(METRIC_HELP[title])}</span></span>`
    : "";
  const freshness = metric?.updated_at ? ` · ${escapeHtml(formatShortDate(metric.updated_at))}` : "";
  return `<div class="metric-box"><div class="metric-top-row"><div class="metric-title">${escapeHtml(title)} ${help}</div>${statusChip(metric?.status || "unknown")}</div><div class="metric-value">${escapeHtml(metric?.formatted || "—")}</div><div class="metric-status-line">${escapeHtml(metric?.source || "—")}${freshness}</div></div>`;
}

function optionalMetricHtml(title, metric) {
  return metric ? metricHtml(title, metric) : "";
}

function formatShortDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("ru-RU", { day:"2-digit", month:"short", year:"numeric" }).format(date) : "";
}
function compactChartHtml(id, caption) {
  return `<div class="integrated-chart"><div class="chart-shell" id="${id}-wrap"><canvas id="${id}"></canvas></div><div class="chart-caption">${escapeHtml(caption)}</div></div>`;
}
function newsHtml(news = {}) {
  const items = Array.isArray(news.items) ? news.items : [];
  const body = items.length ? `<div class="news-list">${items.map((item) => `<a class="news-card" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer"><div class="news-meta"><span>${escapeHtml(formatShortDate(item.date))}</span><span>${escapeHtml(item.source || news.source || "Источник")}</span></div><h3>${escapeHtml(item.title)}</h3>${item.snippet ? `<p>${escapeHtml(item.snippet)}</p>` : ""}</a>`).join("")}</div>` : `<div class="news-empty">Свежие новости временно недоступны</div>`;
  return `<section class="panel news-section"><div class="section-title">Последние новости</div><div class="section-sub">Показываются 5 самых свежих событий за последние 30 дней</div>${body}</section>`;
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
  return `<div class="list-item top-gap"><strong>Общий вывод</strong><br>${escapeHtml(conclusion)}</div>`;
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
    if (raw && typeof raw === "object") raw = raw.peggedUSD ?? raw.usd ?? null;
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
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
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
  const labels = timestamps.map((ts) => new Date(ts).toLocaleDateString("ru-RU", { day:"2-digit", month:"2-digit" }));
  const prepared = datasets.filter((dataset) => dataset.series?.length).map((dataset) => {
    const map = new Map(dataset.series.map((point) => [point.ts, point.value]));
    return { label: dataset.label, data: timestamps.map((ts) => map.has(ts) ? map.get(ts) : null), borderWidth:2, tension:.25, pointRadius:0, spanGaps:true, fill:false, yAxisID:dataset.yAxisID || "y", hidden:!!dataset.hidden };
  });
  return { labels, prepared };
}

function createLineChart(canvasId, datasets) {
  const el = document.getElementById(canvasId);
  if (!el || !datasets?.length) return null;
  const { labels, prepared } = mergeSeriesByTimestamp(datasets);
  if (!prepared.length || !labels.length) {
    showChartEmpty(canvasId, "Данные для графика пока не подтянулись.");
    return null;
  }
  clearChartEmpty(canvasId);
  return new Chart(el, {
    type: "line",
    data: { labels, datasets: prepared },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: true, labels: { color:"#dce6ff" } },
        tooltip: { callbacks: { label(context) { return context.parsed.y == null ? `${context.dataset.label}: —` : `${context.dataset.label}: ${formatAxisValue(context.parsed.y)}`; } } }
      },
      scales: {
        x: { ticks: { color:"#a8b2c7", maxTicksLimit:8 }, grid: { color:"rgba(255,255,255,.06)" } },
        y: { position:"left", ticks: { color:"#a8b2c7", callback(value){ return formatAxisValue(Number(value)); } }, grid: { color:"rgba(255,255,255,.06)" } },
        y1: { display: prepared.some((x) => x.yAxisID === "y1"), position:"right", ticks: { color:"#a8b2c7", callback(value){ return formatAxisValue(Number(value)); } }, grid: { drawOnChartArea:false } }
      }
    }
  });
}

function createBarChart(canvasId, series, label) {
  const el = document.getElementById(canvasId);
  if (!el) return null;
  if (!series?.length) {
    showChartEmpty(canvasId, "Данные для графика пока не подтянулись.");
    return null;
  }
  clearChartEmpty(canvasId);
  return new Chart(el, {
    type: "bar",
    data: { labels: series.map((x) => x.label), datasets: [{ label, data: series.map((x) => x.value), borderWidth:0 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color:"#dce6ff" } },
        tooltip: { callbacks: { label(context){ return context.parsed.y == null ? `${label}: —` : `${label}: ${formatAxisValue(context.parsed.y)}`; } } }
      },
      scales: {
        x: { ticks:{ color:"#a8b2c7", maxTicksLimit:8 }, grid:{ color:"rgba(255,255,255,.04)" } },
        y: { ticks:{ color:"#a8b2c7", callback(value){ return formatAxisValue(Number(value)); } }, grid:{ color:"rgba(255,255,255,.06)" } }
      }
    }
  });
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
    const res = await fetch(`/api/report/${slug}`);
    const data = await res.json();
    if (!res.ok) {
      app.innerHTML = `<div class="error-box">Ошибка: ${escapeHtml(data.error || "не удалось загрузить отчет")}</div>`;
      return;
    }

    const tvSymbolMap = { eth:"BINANCE:ETHUSDT", sol:"BINANCE:SOLUSDT", link:"BINANCE:LINKUSDT" };
    app.innerHTML = `<div class="layout"><aside class="sidebar-card"><div class="eyebrow">Crypto Project Deep Dive</div><div class="project-main">${escapeHtml(data.meta.project_name)}</div><div class="project-sub">${escapeHtml(data.meta.subtitle)}</div><div class="tag-row">${(data.meta.categories || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}</div><div class="small-note">Обновлено: ${new Date(data.meta.updated_at).toLocaleString("ru-RU")}</div><div class="small-note">Slug: ${escapeHtml(data.meta.slug)}</div></aside><main class="content">
      <section class="panel hero-overview"><div class="hero-heading"><h1>${escapeHtml(data.meta.project_name || data.hero.title)}</h1><div class="hero-ticker">${escapeHtml(data.meta.ticker || "")}</div></div>${data.hero.subtitle ? `<div class="subtitle">${escapeHtml(data.hero.subtitle)}</div>` : ""}<p class="lead">${escapeHtml(data.hero.lead)}</p>
      <div class="hero-grid">${metricHtml("Цена", data.market.price)}${metricHtml("Рыночная капитализация", data.market.market_cap)}${metricHtml("FDV", data.market.fdv)}${metricHtml("Объем 24ч", data.market.volume_24h)}${metricHtml("TVL", data.capital.metrics.tvl)}${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}</div>
      <div class="three-col top-gap"><div class="list-item"><strong>Главная сила</strong><br>${escapeHtml(data.hero.main_strength || "—")}</div><div class="list-item"><strong>Главный риск</strong><br>${escapeHtml(data.hero.main_risk || "—")}</div><div class="list-item"><strong>Общий статус</strong><br>${escapeHtml(data.hero.status_text || "—")}</div></div></section>
      ${tradingViewCard()}
      ${technicalBiasHtml(data.technical_bias)}
      ${data.meta?.features?.hideExecutiveSummary ? "" : `<section class="panel"><div class="section-title">Executive Summary</div><div class="list-wrap">${listHtml(data.executive_summary?.items)}</div></section>`}
      <section class="panel section-flow"><div class="section-title">Токеномика</div><div class="section-sub">Баланс предложения, выпуска и сжигания ETH</div><div class="hero-grid">${metricHtml("Market Cap", data.tokenomics.metrics.market_cap)}${metricHtml("FDV", data.tokenomics.metrics.fdv)}${metricHtml("Circulating Supply", data.tokenomics.metrics.circulating_supply)}${metricHtml("Total Supply", data.tokenomics.metrics.total_supply)}${metricHtml("Max Supply", data.tokenomics.metrics.max_supply)}${optionalMetricHtml("Net Issuance", data.tokenomics.metrics.net_issuance)}${optionalMetricHtml("Burn Mechanism", data.tokenomics.metrics.burn_mechanism)}${optionalMetricHtml("Market Buyback", data.tokenomics.metrics.market_buyback)}</div>${insightHtml(data.tokenomics)}</section>
      <section class="panel section-flow"><div class="section-title">Финансы</div>${(data.financials.text || []).slice(0, 2).map((p) => `<p class="lead compact-lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid finance-kpis">${metricHtml("Chain Fees 24h", data.financials.metrics.chain_fees_24h)}${metricHtml("DEX Volume 24h", data.financials.metrics.dex_volume_24h)}${metricHtml("Объем 24ч / капитализация", data.financials.metrics.volume_market_cap)}</div><div class="chart-stack">${compactChartHtml("feesChart", data.fees_block?.note || "Комиссии отражают спрос на блокспейс и денежную нагрузку сети.")}${compactChartHtml("dexChart", data.dex_block?.note || "DEX-оборот отражает глубину on-chain торговой активности.")}</div>${insightHtml(data.financials)}</section>
      <section class="panel section-flow capital-section"><div class="section-title">TVL и капитал</div>${(data.capital.text || []).slice(0, 1).map((p) => `<p class="lead compact-lead">${escapeHtml(p)}</p>`).join("")}<div class="hero-grid capital-kpis">${metricHtml("TVL", data.capital.metrics.tvl)}${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}${metricHtml("RWA Active Mcap", data.capital.metrics.rwa_active_mcap)}</div><div class="capital-charts">${compactChartHtml("tvlChart", "TVL показывает капитал, размещенный в DeFi-слое экосистемы.")}${compactChartHtml("stableChart", data.stablecoins_block?.note || "Стейблкоины показывают расчетную ликвидность внутри сети.")}</div>${insightHtml(data.capital)}</section>
      ${usersSectionHtml(data)}
      <section class="panel"><div class="section-title">Резюме</div><div class="columns-4 profile-grid"><div><h3>Сильные стороны</h3>${listHtml(data.profile.strengths)}</div><div><h3>Слабые стороны</h3>${listHtml(data.profile.weaknesses)}</div><div><h3>Риски</h3>${listHtml(data.profile.risks)}</div><div><h3>Что отслеживать</h3>${listHtml(data.profile.watch)}</div></div></section>
      ${newsHtml(data.news)}
    </main></div>`;

    const tvlSeriesRaw = sanitizeSeries(normalizeLlamaSeries(data?.charts?.tvl_history, "totalLiquidityUSD"), { trimLeadingZeroes:true });
    const stableSeriesRaw = sanitizeSeries(normalizeLlamaSeries(data?.charts?.stablecoins_history, "totalCirculatingUSD"), { trimLeadingZeroes:true });
    const tvlSeries = sanitizeSeries(tvlSeriesRaw, { trimLeadingZeroes:true });
    const stableSeries = sanitizeSeries(stableSeriesRaw, { trimLeadingZeroes:true });
    const feesSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.fees_history), { trimLeadingZeroes:true });
    const dexSeries = sanitizeSeries(normalizeLlamaOverviewChart(data?.charts?.dex_history), { trimLeadingZeroes:true });

    createBarChart("feesChart", feesSeries, "Fees");
    createBarChart("dexChart", dexSeries, "DEX Volume");
    createLineChart("tvlChart", [{ label:"TVL", series:tvlSeries, yAxisID:"y" }]);
    createLineChart("stableChart", [{ label:"Stablecoins", series:stableSeries, yAxisID:"y" }]);
    initTradingView(tvSymbolMap[slug] || "BINANCE:ETHUSDT");
  } catch (error) {
    app.innerHTML = `<div class="error-box">Ошибка загрузки: ${escapeHtml(error.message)}</div>`;
  }
}

loadReport();
