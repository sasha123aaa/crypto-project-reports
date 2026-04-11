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
  "Volume / Market Cap": "Отношение объема торгов к капитализации. Показывает активность рынка относительно размера актива.",
  "Market Cap / TVL": "Сравнение капитализации актива с капиталом внутри сети.",
  "Stablecoins / TVL": "Отношение объема стейблкоинов в сети к TVL.",
  "Circulating Supply": "Количество монет, которые реально находятся в обращении.",
  "Total Supply": "Общее текущее предложение монет.",
  "Max Supply": "Максимально возможное предложение, если оно существует.",
  "Daily Active Addresses": "Количество активных адресов за день.",
  "New Addresses": "Количество новых адресов за период.",
  "Transactions": "Количество транзакций за период.",
  "Статус оценки": "Краткая качественная оценка текущей стадии актива."
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function statusChip(status = "unknown") {
  const labelMap = {
    live: "LIVE",
    manual: "MANUAL",
    calculated: "CALC",
    partial: "PARTIAL",
    unavailable: "N/A",
    unknown: "UNKNOWN"
  };

  return `<span class="status-chip ${escapeHtml(status)}">${labelMap[status] || status.toUpperCase()}</span>`;
}

function metricHtml(title, metric) {
  const safeTitle = escapeHtml(title);
  const help = METRIC_HELP[title]
    ? `<span class="info-wrap"><span class="info-icon">i</span><span class="tooltip">${escapeHtml(METRIC_HELP[title])}</span></span>`
    : "";

  return `
    <div class="metric-box">
      <div class="metric-top-row">
        <div class="metric-title">${safeTitle} ${help}</div>
        ${statusChip(metric?.status || "unknown")}
      </div>
      <div class="metric-value">${escapeHtml(metric?.formatted || "—")}</div>
      <div class="metric-status-line">${escapeHtml(metric?.source || "—")}</div>
    </div>
  `;
}

function listHtml(items = []) {
  return items.map((item) => `<div class="list-item">${escapeHtml(item)}</div>`).join("");
}

function chartCard(id, title, subtitle = "", controlsHtml = "") {
  return `
    <section class="panel">
      <div class="chart-head">
        <div>
          <div class="section-title">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="section-sub">${escapeHtml(subtitle)}</div>` : ""}
        </div>
        ${controlsHtml ? `<div class="chart-controls">${controlsHtml}</div>` : ""}
      </div>
      <div class="chart-shell">
        <canvas id="${id}"></canvas>
      </div>
    </section>
  `;
}

function tradingViewCard(symbol = "BINANCE:ETHUSDT") {
  return `
    <section class="panel">
      <div class="section-title">Живой график TradingView</div>
      <div class="section-sub">Интерактивный график для детального просмотра цены и структуры рынка</div>
      <div class="tv-shell">
        <div id="tv-widget"></div>
      </div>
      <script src="https://s3.tradingview.com/tv.js"></script>
    </section>
  `;
}

function normalizeCoinGeckoPrices(prices = []) {
  return (prices || [])
    .map((row) => {
      const ts = Array.isArray(row) ? row[0] : null;
      const value = Array.isArray(row) ? Number(row[1]) : null;
      if (!ts || !Number.isFinite(value)) return null;

      return {
        label: new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        value
      };
    })
    .filter(Boolean);
}

function normalizeLlamaSeries(rows = [], key) {
  return (rows || [])
    .map((row) => {
      const ts = row?.date ? Number(row.date) * 1000 : null;
      const raw = row?.[key] ?? row?.totalLiquidityUSD ?? row?.totalCirculatingUSD ?? null;
      const value = Number(raw);

      if (!ts || !Number.isFinite(value)) return null;

      return {
        label: new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        value
      };
    })
    .filter(Boolean);
}

function normalizeLlamaOverviewChart(rows = []) {
  return (rows || [])
    .map((row) => {
      const ts = Array.isArray(row) ? Number(row[0]) : null;
      const value = Array.isArray(row) ? Number(row[1]) : null;

      if (!ts || !Number.isFinite(value)) return null;

      return {
        label: new Date(ts * 1000).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        value
      };
    })
    .filter(Boolean);
}

function formatAxisValue(value) {
  if (!Number.isFinite(value)) return "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

function createLineChart(canvasId, datasets) {
  const el = document.getElementById(canvasId);
  if (!el || !datasets?.length) return;

  const labels = datasets[0]?.series?.map((x) => x.label) || [];
  const prepared = datasets
    .filter((item) => item.series?.length)
    .map((item) => ({
      label: item.label,
      data: item.series.map((x) => x.value),
      borderWidth: 2,
      tension: 0.25,
      pointRadius: 0,
      fill: false,
      yAxisID: item.yAxisID || "y"
    }));

  new Chart(el, {
    type: "line",
    data: {
      labels,
      datasets: prepared
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          display: true,
          labels: { color: "#dce6ff" }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatAxisValue(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#a8b2c7", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,.06)" }
        },
        y: {
          position: "left",
          ticks: {
            color: "#a8b2c7",
            callback(value) {
              return formatAxisValue(Number(value));
            }
          },
          grid: { color: "rgba(255,255,255,.06)" }
        },
        y1: {
          display: prepared.some((x) => x.yAxisID === "y1"),
          position: "right",
          ticks: {
            color: "#a8b2c7",
            callback(value) {
              return formatAxisValue(Number(value));
            }
          },
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

function createBarChart(canvasId, series, label) {
  const el = document.getElementById(canvasId);
  if (!el || !series?.length) return;

  new Chart(el, {
    type: "bar",
    data: {
      labels: series.map((x) => x.label),
      datasets: [{
        label,
        data: series.map((x) => x.value),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#dce6ff" } },
        tooltip: {
          callbacks: {
            label(context) {
              return `${label}: ${formatAxisValue(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: "#a8b2c7", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,.04)" }
        },
        y: {
          ticks: {
            color: "#a8b2c7",
            callback(value) {
              return formatAxisValue(Number(value));
            }
          },
          grid: { color: "rgba(255,255,255,.06)" }
        }
      }
    }
  });
}

function technicalBiasHtml(bias) {
  const order = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];
  const chips = order.map((tf) => {
    const state = bias?.timeframes?.[tf] || "neutral";
    return `<div class="bias-chip ${escapeHtml(state)}">${tf} <span class="bias-dot"></span></div>`;
  }).join("");

  return `
    <section class="panel">
      <div class="section-title">Быстрый теханализ</div>
      <div class="section-sub">Краткая оценка структуры по ключевым таймфреймам</div>
      <div class="ta-meta-row">
        <div class="ta-meta-box">
          <div class="metric-title">Источник</div>
          <div class="ta-meta-value">${escapeHtml(bias?.source || "—")}</div>
        </div>
        <div class="ta-meta-box">
          <div class="metric-title">Обновлено</div>
          <div class="ta-meta-value">${bias?.updated_at ? new Date(bias.updated_at).toLocaleString("ru-RU") : "—"}</div>
        </div>
      </div>
      <div class="bias-grid">${chips}</div>
      <div class="three-col">
        <div class="list-item">${escapeHtml(bias?.notes?.lower_tf || "—")}</div>
        <div class="list-item">${escapeHtml(bias?.notes?.mid_tf || "—")}</div>
        <div class="list-item">${escapeHtml(bias?.notes?.higher_tf || "—")}</div>
      </div>
    </section>
  `;
}

function buildCoverageHtml(data) {
  const metrics = [
    data?.market?.price,
    data?.market?.market_cap,
    data?.market?.fdv,
    data?.market?.volume_24h,
    data?.capital?.metrics?.tvl,
    data?.capital?.metrics?.stablecoins_mcap,
    data?.financials?.metrics?.chain_fees_24h,
    data?.financials?.metrics?.dex_volume_24h,
    data?.valuation?.metrics?.market_cap_tvl,
    data?.valuation?.metrics?.volume_market_cap,
    data?.valuation?.metrics?.stablecoins_tvl
  ];

  const counts = {
    live: 0,
    manual: 0,
    calculated: 0,
    partial: 0,
    unavailable: 0
  };

  metrics.forEach((m) => {
    const s = m?.status || "unavailable";
    if (counts[s] !== undefined) counts[s] += 1;
    else counts.unavailable += 1;
  });

  return `
    <section class="panel">
      <div class="section-title">Покрытие данных</div>
      <div class="section-sub">Насколько отчет сейчас живой, а не только шаблонный</div>
      <div class="hero-grid">
        <div class="metric-box">
          <div class="metric-top-row"><div class="metric-title">LIVE метрики</div>${statusChip("live")}</div>
          <div class="metric-value">${counts.live}</div>
          <div class="metric-status-line">подтянулись из внешних источников</div>
        </div>
        <div class="metric-box">
          <div class="metric-top-row"><div class="metric-title">MANUAL метрики</div>${statusChip("manual")}</div>
          <div class="metric-value">${counts.manual}</div>
          <div class="metric-status-line">пока взяты из статичного JSON</div>
        </div>
        <div class="metric-box">
          <div class="metric-top-row"><div class="metric-title">CALC метрики</div>${statusChip("calculated")}</div>
          <div class="metric-value">${counts.calculated}</div>
          <div class="metric-status-line">посчитаны на основе live-данных</div>
        </div>
      </div>
    </section>
  `;
}

function buildStatusBanner(meta) {
  const status = meta?.data_status || "unknown";
  const helpMap = {
    "hybrid-live": "Большая часть ключевых метрик подгружена в live-режиме.",
    "hybrid-partial-live": "Часть метрик live, часть пока остается manual.",
    "hybrid-fallback": "Live-источники сработали не полностью, поэтому часть значений показана из резервного JSON."
  };

  return `
    <section class="panel compact-panel">
      <div class="status-banner-row">
        <div class="status-banner-left">
          ${statusChip(
            status === "hybrid-live" ? "live" :
            status === "hybrid-partial-live" ? "partial" :
            "manual"
          )}
          <span class="status-banner-title">${escapeHtml(status)}</span>
        </div>
        <div class="status-banner-text">${escapeHtml(helpMap[status] || "Текущий режим данных отчета.")}</div>
      </div>
    </section>
  `;
}

function initTradingView(symbol) {
  if (!window.TradingView || !document.getElementById("tv-widget")) return;

  new window.TradingView.widget({
    autosize: true,
    symbol,
    interval: "D",
    timezone: "Etc/UTC",
    theme: "dark",
    style: "1",
    locale: "ru",
    enable_publishing: false,
    hide_side_toolbar: false,
    allow_symbol_change: true,
    container_id: "tv-widget"
  });
}

async function loadReport() {
  const slug = getSlug();
  const app = document.getElementById("app");

  try {
    const res = await fetch(`/api/report/${slug}`);
    const data = await res.json();

    if (!res.ok) {
      app.innerHTML = `<div class="error-box">Ошибка: ${escapeHtml(data.error || "не удалось загрузить отчет")}</div>`;
      return;
    }

    document.title = `${data.meta.project_name} — отчет`;

    const tvSymbolMap = {
      eth: "BINANCE:ETHUSDT",
      sol: "BINANCE:SOLUSDT",
      link: "BINANCE:LINKUSDT"
    };

    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar-card">
          <div class="eyebrow">Crypto Project Deep Dive</div>
          <div class="project-main">${escapeHtml(data.meta.project_name)}</div>
          <div class="project-sub">${escapeHtml(data.meta.subtitle)}</div>
          <div class="tag-row">
            ${(data.meta.categories || []).map((x) => `<span class="tag">${escapeHtml(x)}</span>`).join("")}
          </div>
          <div class="small-note">Обновлено: ${new Date(data.meta.updated_at).toLocaleString("ru-RU")}</div>
          <div class="small-note">Статус данных: ${escapeHtml(data.meta.data_status)}</div>
          <div class="small-note">Slug: ${escapeHtml(data.meta.slug)}</div>
        </aside>

        <main class="content">
          ${buildStatusBanner(data.meta)}

          <section class="panel">
            <div class="eyebrow">Первый экран</div>
            <h1>${escapeHtml(data.hero.title)}</h1>
            <div class="subtitle">${escapeHtml(data.hero.subtitle)}</div>
            <p class="lead">${escapeHtml(data.hero.lead)}</p>

            <div class="hero-grid">
              ${metricHtml("Цена", data.market.price)}
              ${metricHtml("Рыночная капитализация", data.market.market_cap)}
              ${metricHtml("FDV", data.market.fdv)}
              ${metricHtml("Объем 24ч", data.market.volume_24h)}
              ${metricHtml("TVL", data.capital.metrics.tvl)}
              ${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}
            </div>

            <div class="three-col top-gap">
              <div class="list-item"><strong>Главная сила</strong><br>${escapeHtml(data.hero.main_strength || "—")}</div>
              <div class="list-item"><strong>Главный риск</strong><br>${escapeHtml(data.hero.main_risk || "—")}</div>
              <div class="list-item"><strong>Общий статус</strong><br>${escapeHtml(data.hero.status_text || "—")}</div>
            </div>
          </section>

          ${buildCoverageHtml(data)}
          ${tradingViewCard(tvSymbolMap[slug] || "BINANCE:ETHUSDT")}

          ${chartCard(
            "priceChart",
            "Цена актива",
            "История цены по CoinGecko"
          )}

          ${chartCard(
            "comboChart",
            "Сравнение капитализации экосистемы",
            "Цена, TVL и стейблкоины в одном окне"
          )}

          ${technicalBiasHtml(data.technical_bias)}

          <section class="panel">
            <div class="section-title">Executive Summary</div>
            <div class="list-wrap">${listHtml(data.executive_summary.items)}</div>
          </section>

          <section class="panel">
            <div class="section-title">Быстрый профиль</div>
            <div class="columns-4">
              <div><h3>Сильные стороны</h3>${listHtml(data.profile.strengths)}</div>
              <div><h3>Слабые стороны</h3>${listHtml(data.profile.weaknesses)}</div>
              <div><h3>Риски</h3>${listHtml(data.profile.risks)}</div>
              <div><h3>Что отслеживать</h3>${listHtml(data.profile.watch)}</div>
            </div>
          </section>

          <section class="panel">
            <div class="section-title">${escapeHtml(data.about.title)}</div>
            ${(data.about.paragraphs || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
          </section>

          <section class="panel">
            <div class="section-title">Токеномика</div>
            ${(data.tokenomics.text || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("Market Cap", data.tokenomics.metrics.market_cap)}
              ${metricHtml("FDV", data.tokenomics.metrics.fdv)}
              ${metricHtml("Circulating Supply", data.tokenomics.metrics.circulating_supply)}
              ${metricHtml("Total Supply", data.tokenomics.metrics.total_supply)}
              ${metricHtml("Max Supply", data.tokenomics.metrics.max_supply)}
            </div>
          </section>

          <section class="panel">
            <div class="section-title">Финансы</div>
            ${(data.financials.text || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("Chain Fees 24h", data.financials.metrics.chain_fees_24h)}
              ${metricHtml("DEX Volume 24h", data.financials.metrics.dex_volume_24h)}
              ${metricHtml("Volume / Market Cap", data.financials.metrics.volume_market_cap)}
            </div>
          </section>

          ${chartCard("feesChart", "История сетевых комиссий", "Динамика fees по DefiLlama")}
          ${chartCard("dexChart", "DEX Volume", "История объема DEX внутри сети")}

          <section class="panel">
            <div class="section-title">TVL и капитал</div>
            ${(data.capital.text || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("TVL", data.capital.metrics.tvl)}
              ${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}
            </div>
          </section>

          ${chartCard("tvlChart", "TVL", "История TVL по DefiLlama")}
          ${chartCard("stableChart", "Stablecoins внутри сети", "История стейблкоинов по DefiLlama")}

          <section class="panel">
            <div class="section-title">Пользователи</div>
            ${(data.users.text || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("Daily Active Addresses", data.users.metrics.daily_active_addresses)}
              ${metricHtml("New Addresses", data.users.metrics.new_addresses)}
              ${metricHtml("Transactions", data.users.metrics.transactions)}
            </div>
          </section>

          <section class="panel">
            <div class="section-title">Оценка</div>
            ${(data.valuation.text || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("Market Cap / TVL", data.valuation.metrics.market_cap_tvl)}
              ${metricHtml("Volume / Market Cap", data.valuation.metrics.volume_market_cap)}
              ${metricHtml("Stablecoins / TVL", data.valuation.metrics.stablecoins_tvl)}
              ${metricHtml("Статус оценки", data.valuation.metrics.valuation_status)}
            </div>
          </section>

          <section class="panel">
            <div class="section-title">Риски</div>
            <div class="list-wrap">${listHtml(data.risks.items)}</div>
          </section>

          <section class="panel">
            <div class="section-title">Что отслеживать</div>
            <div class="list-wrap">${listHtml(data.watchlist.items)}</div>
          </section>

          <section class="panel">
            <div class="section-title">${escapeHtml(data.final_verdict.title)}</div>
            <div class="subtitle">${escapeHtml(data.final_verdict.subtitle)}</div>
            ${(data.final_verdict.paragraphs || []).map((p) => `<p class="lead">${escapeHtml(p)}</p>`).join("")}
          </section>
        </main>
      </div>
    `;

    const priceSeries = normalizeCoinGeckoPrices(data?.charts?.price_history);
    const tvlSeries = normalizeLlamaSeries(data?.charts?.tvl_history, "totalLiquidityUSD");
    const stableSeries = normalizeLlamaSeries(data?.charts?.stablecoins_history, "totalCirculatingUSD");
    const feesSeries = normalizeLlamaOverviewChart(data?.charts?.fees_history);
    const dexSeries = normalizeLlamaOverviewChart(data?.charts?.dex_history);

    createLineChart("priceChart", [
      { label: "Цена", series: priceSeries, yAxisID: "y" }
    ]);

    createLineChart("comboChart", [
      { label: "Цена", series: priceSeries, yAxisID: "y" },
      { label: "TVL", series: tvlSeries, yAxisID: "y1" },
      { label: "Stablecoins", series: stableSeries, yAxisID: "y1" }
    ]);

    createBarChart("feesChart", feesSeries, "Fees");
    createBarChart("dexChart", dexSeries, "DEX Volume");

    createLineChart("tvlChart", [
      { label: "TVL", series: tvlSeries, yAxisID: "y" }
    ]);

    createLineChart("stableChart", [
      { label: "Stablecoins", series: stableSeries, yAxisID: "y" }
    ]);

    setTimeout(() => initTradingView(tvSymbolMap[slug] || "BINANCE:ETHUSDT"), 300);
  } catch (error) {
    app.innerHTML = `<div class="error-box">Ошибка загрузки: ${escapeHtml(error.message)}</div>`;
  }
}

loadReport();
