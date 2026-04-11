function getSlug() {
  const url = new URL(window.location.href);
  return url.searchParams.get("slug") || "eth";
}

function metricHtml(title, metric) {
  return `
    <div class="metric-box">
      <div class="metric-title">${title}</div>
      <div class="metric-value">${metric?.formatted || "—"}</div>
      <div class="metric-status">${metric?.status || "unavailable"} · ${metric?.source || "—"}</div>
    </div>
  `;
}

function listHtml(items = []) {
  return items.map((item) => `<div class="list-item">${item}</div>`).join("");
}

function chartCard(id, title, subtitle = "") {
  return `
    <section class="panel">
      <div class="section-title">${title}</div>
      ${subtitle ? `<div class="section-sub">${subtitle}</div>` : ""}
      <div class="chart-shell">
        <canvas id="${id}"></canvas>
      </div>
    </section>
  `;
}

function normalizeCoinGeckoPrices(prices = []) {
  return (prices || []).map(([ts, value]) => ({
    label: new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
    value,
  }));
}

function normalizeLlamaSeries(rows = [], key) {
  return (rows || [])
    .map((row) => {
      const ts = row?.date ? row.date * 1000 : null;
      const value = row?.[key] ?? row?.totalLiquidityUSD ?? row?.totalCirculatingUSD ?? null;
      if (!ts || value == null) return null;
      return {
        label: new Date(ts).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        value,
      };
    })
    .filter(Boolean);
}

function normalizeLlamaOverviewChart(rows = []) {
  return (rows || [])
    .map((row) => {
      const ts = Array.isArray(row) ? row[0] : null;
      const value = Array.isArray(row) ? row[1] : null;
      if (!ts || value == null) return null;
      return {
        label: new Date(ts * 1000).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }),
        value,
      };
    })
    .filter(Boolean);
}

function createLineChart(canvasId, series, label) {
  const el = document.getElementById(canvasId);
  if (!el || !series?.length) return;

  new Chart(el, {
    type: "line",
    data: {
      labels: series.map((x) => x.label),
      datasets: [{
        label,
        data: series.map((x) => x.value),
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 0,
        fill: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: {
          labels: { color: "#dce6ff" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#a8b2c7", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,.06)" },
        },
        y: {
          ticks: { color: "#a8b2c7" },
          grid: { color: "rgba(255,255,255,.06)" },
        },
      },
    },
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
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#dce6ff" },
        },
      },
      scales: {
        x: {
          ticks: { color: "#a8b2c7", maxTicksLimit: 8 },
          grid: { color: "rgba(255,255,255,.04)" },
        },
        y: {
          ticks: { color: "#a8b2c7" },
          grid: { color: "rgba(255,255,255,.06)" },
        },
      },
    },
  });
}

function technicalBiasHtml(bias) {
  const order = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w"];
  const chips = order.map((tf) => {
    const state = bias?.timeframes?.[tf] || "neutral";
    return `<div class="bias-chip ${state}">${tf} <span class="bias-dot"></span></div>`;
  }).join("");

  return `
    <section class="panel">
      <div class="section-title">Быстрый теханализ</div>
      <div class="section-sub">Краткая оценка структуры по ключевым таймфреймам</div>
      <div class="ta-meta-row">
        <div class="ta-meta-box">
          <div class="metric-title">Источник</div>
          <div class="ta-meta-value">${bias?.source || "—"}</div>
        </div>
        <div class="ta-meta-box">
          <div class="metric-title">Обновлено</div>
          <div class="ta-meta-value">${bias?.updated_at ? new Date(bias.updated_at).toLocaleString("ru-RU") : "—"}</div>
        </div>
      </div>
      <div class="bias-grid">${chips}</div>
      <div class="three-col">
        <div class="list-item">${bias?.notes?.lower_tf || "—"}</div>
        <div class="list-item">${bias?.notes?.mid_tf || "—"}</div>
        <div class="list-item">${bias?.notes?.higher_tf || "—"}</div>
      </div>
    </section>
  `;
}

async function loadReport() {
  const slug = getSlug();
  const app = document.getElementById("app");

  try {
    const res = await fetch(`/api/report/${slug}`);
    const data = await res.json();

    if (!res.ok) {
      app.innerHTML = `<div class="error-box">Ошибка: ${data.error || "не удалось загрузить отчет"}</div>`;
      return;
    }

    document.title = `${data.meta.project_name} — отчет`;

    app.innerHTML = `
      <div class="layout">
        <aside class="sidebar-card">
          <div class="eyebrow">Crypto Project Deep Dive</div>
          <div class="project-main">${data.meta.project_name}</div>
          <div class="project-sub">${data.meta.subtitle}</div>
          <div class="tag-row">
            ${(data.meta.categories || []).map((x) => `<span class="tag">${x}</span>`).join("")}
          </div>
          <div class="small-note">Обновлено: ${new Date(data.meta.updated_at).toLocaleString("ru-RU")}</div>
          <div class="small-note">Статус данных: ${data.meta.data_status}</div>
          <div class="small-note">Slug: ${data.meta.slug}</div>
        </aside>

        <main class="content">
          <section class="panel">
            <div class="eyebrow">Первый экран</div>
            <h1>${data.hero.title}</h1>
            <div class="subtitle">${data.hero.subtitle}</div>
            <p class="lead">${data.hero.lead}</p>

            <div class="hero-grid">
              ${metricHtml("Цена", data.market.price)}
              ${metricHtml("Рыночная капитализация", data.market.market_cap)}
              ${metricHtml("FDV", data.market.fdv)}
              ${metricHtml("Объем 24ч", data.market.volume_24h)}
              ${metricHtml("TVL", data.capital.metrics.tvl)}
              ${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}
            </div>

            <div class="three-col top-gap">
              <div class="list-item"><strong>Главная сила</strong><br>${data.hero.main_strength || "—"}</div>
              <div class="list-item"><strong>Главный риск</strong><br>${data.hero.main_risk || "—"}</div>
              <div class="list-item"><strong>Общий статус</strong><br>${data.hero.status_text || "—"}</div>
            </div>
          </section>

          ${chartCard("priceChart", "Цена актива", "История цены по CoinGecko")}
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
            <div class="section-title">${data.about.title}</div>
            ${(data.about.paragraphs || []).map((p) => `<p class="lead">${p}</p>`).join("")}
          </section>

          <section class="panel">
            <div class="section-title">Токеномика</div>
            ${(data.tokenomics.text || []).map((p) => `<p class="lead">${p}</p>`).join("")}
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
            ${(data.financials.text || []).map((p) => `<p class="lead">${p}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("Chain Fees 24h", data.financials.metrics.chain_fees_24h)}
              ${metricHtml("DEX Volume 24h", data.financials.metrics.dex_volume_24h)}
              ${metricHtml("Volume / Market Cap", data.financials.metrics.volume_market_cap)}
            </div>
          </section>

          ${chartCard("feesChart", "История сетевых комиссий", "Динамика fees по DefiLlama")}

          <section class="panel">
            <div class="section-title">TVL и капитал</div>
            ${(data.capital.text || []).map((p) => `<p class="lead">${p}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("TVL", data.capital.metrics.tvl)}
              ${metricHtml("Stablecoins Mcap", data.capital.metrics.stablecoins_mcap)}
            </div>
          </section>

          ${chartCard("tvlChart", "TVL", "История TVL по DefiLlama")}
          ${chartCard("stableChart", "Stablecoins внутри сети", "История стейблкоинов по DefiLlama")}

          <section class="panel">
            <div class="section-title">Пользователи</div>
            ${(data.users.text || []).map((p) => `<p class="lead">${p}</p>`).join("")}
            <div class="hero-grid">
              ${metricHtml("Daily Active Addresses", data.users.metrics.daily_active_addresses)}
              ${metricHtml("New Addresses", data.users.metrics.new_addresses)}
              ${metricHtml("Transactions", data.users.metrics.transactions)}
            </div>
          </section>

          <section class="panel">
            <div class="section-title">Оценка</div>
            ${(data.valuation.text || []).map((p) => `<p class="lead">${p}</p>`).join("")}
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
            <div class="section-title">${data.final_verdict.title}</div>
            <div class="subtitle">${data.final_verdict.subtitle}</div>
            ${(data.final_verdict.paragraphs || []).map((p) => `<p class="lead">${p}</p>`).join("")}
          </section>
        </main>
      </div>
    `;

    createLineChart("priceChart", normalizeCoinGeckoPrices(data?.charts?.price_history), "Цена");
    createBarChart("feesChart", normalizeLlamaOverviewChart(data?.charts?.fees_history), "Fees");
    createLineChart("tvlChart", normalizeLlamaSeries(data?.charts?.tvl_history, "totalLiquidityUSD"), "TVL");
    createLineChart("stableChart", normalizeLlamaSeries(data?.charts?.stablecoins_history, "totalCirculatingUSD"), "Stablecoins");
  } catch (error) {
    app.innerHTML = `<div class="error-box">Ошибка загрузки: ${error.message}</div>`;
  }
}

loadReport();
