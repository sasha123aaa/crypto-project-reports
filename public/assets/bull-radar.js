(function () {
  const TFS = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];
  const EXCHANGES = [
    { id:"BYBIT", label:"Bybit", enabled:true, checked:true },
    { id:"BINANCE", label:"Binance", enabled:false, checked:false, note:"в разработке" },
    { id:"GATEIO", label:"Gate.io", enabled:false, checked:false, note:"в разработке" },
  ];
  const defaults = { avgFibs:[1, 1.5, 2] };
  let rawRows = [], rows = [], selectedId = null, chart = null, lastUpdated = null, lastChartKey = null;
  let sortState = { key: "distanceToEntry", dir: "asc" };
  let scanGeneration = 0;
  let isScanning = false;
  const $ = (id) => document.getElementById(id);
  const hasNumber = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const money = (v) => hasNumber(v) ? new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:Number(v) < 1 ? 6 : 2 }).format(Number(v)) : "—";
  const pct = (v) => hasNumber(v) ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";
  const compact = (v) => hasNumber(v) ? new Intl.NumberFormat("ru-RU", { notation:"compact", maximumFractionDigits:1 }).format(Number(v)) : "—";
  const clamp = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function fibPrice(range, fib, logBased = false) {
    const top = Math.max(Number(range.aPrice), Number(range.bPrice)), bottom = Math.min(Number(range.aPrice), Number(range.bPrice));
    if (!(top > 0 && bottom > 0)) return NaN;
    if (logBased) return Math.exp(Math.log(top) - Number(fib) * (Math.log(top) - Math.log(bottom)));
    return top - Number(fib) * (top - bottom);
  }
  function buildRadarLevels(range, settings) {
    const entryFib = clamp(settings.entryFib, .3, .99, .5), avgFibs = settings.avgFibs.slice(0, settings.averageCount);
    const specs = [0, entryFib, ...avgFibs], logBased = specs.some((fib) => fibPrice(range, fib) <= 0);
    return { take:{ label:"Тейк", fib:0, value:fibPrice(range, 0, logBased), state:"take" }, entry:{ label:"Вход", fib:entryFib, value:fibPrice(range, entryFib, logBased), state:"waiting" }, averages:avgFibs.map((fib, i) => ({ label:`Уср. ${i + 1}`, fib, value:fibPrice(range, fib, logBased), state:"waiting" })), logBased };
  }
  function chartLevels(levels) { const out = { take:levels.take, entry:levels.entry }; levels.averages.forEach((x, i) => out[`average${i + 1}`] = x); return out; }
  function status(price, levels, absDistance) { const avg1 = levels.averages[0]?.value; if (absDistance <= 1) return "Готово к входу"; if (price > levels.entry.value) return "Выше входа"; if (Number.isFinite(avg1) && price <= avg1) return "На усреднении"; if (price < levels.entry.value) return "Ждем вход"; return "Далеко от входа"; }
  function statusClass(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("готово")) return "ready";
    if (text.includes("выше")) return "above";
    if (text.includes("ждем")) return "waiting";
    if (text.includes("усредн")) return "average";
    return "neutral";
  }


  const TF_ORDER = {
    "1m": 1,
    "3m": 2,
    "5m": 3,
    "15m": 4,
    "1h": 5,
    "4h": 6,
    "1d": 7,
    "1w": 8,
    "1M": 9,
  };

  const STATUS_ORDER = {
    "Готово к входу": 1,
    "Ждем вход": 2,
    "Выше входа": 3,
    "На усреднении": 4,
    "Далеко от входа": 5,
  };

  function sortInitialDir(key) {
    const descFirst = new Set([
      "price",
      "change24hPct",
      "rangePct",
      "potential",
      "volume24h",
      "take",
      "entry",
      "avg1",
      "avg2",
      "avg3",
    ]);

    if (key === "distanceToEntry") return "asc";
    if (key === "ticker" || key === "exchange" || key === "timeframe" || key === "status") return "asc";

    return descFirst.has(key) ? "desc" : "asc";
  }

  function sortValue(row, key) {
    switch (key) {
      case "ticker":
        return String(row.ticker || "").toUpperCase();

      case "timeframe":
        return TF_ORDER[row.timeframe] || 999;

      case "exchange":
        return String(row.exchange || "");

      case "price":
        return Number(row.price);

      case "change24hPct":
        return Number(row.change24hPct);

      case "distanceToEntry":
        return Number(row.metrics?.absDistanceToEntryPct);

      case "rangePct":
        return Number(row.metrics?.rangePct);

      case "entry":
        return Number(row.levels?.entry?.value);

      case "avg1":
        return Number(row.levels?.averages?.[0]?.value);

      case "avg2":
        return Number(row.levels?.averages?.[1]?.value);

      case "avg3":
        return Number(row.levels?.averages?.[2]?.value);

      case "take":
        return Number(row.levels?.take?.value);

      case "potential":
        return Number(row.metrics?.potentialToTakePct);

      case "volume24h":
        return Number(row.volume24h);

      case "status":
        return STATUS_ORDER[row.metrics?.status] || 999;

      default:
        return null;
    }
  }

  function compareSortValues(a, b, dir = "asc") {
    const aMissing = a === null || a === undefined || a === "" || (typeof a === "number" && !Number.isFinite(a));
    const bMissing = b === null || b === undefined || b === "" || (typeof b === "number" && !Number.isFinite(b));

    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    let result = 0;

    if (typeof a === "string" || typeof b === "string") {
      result = String(a).localeCompare(String(b), "ru", { numeric: true, sensitivity: "base" });
    } else {
      result = Number(a) - Number(b);
    }

    return dir === "desc" ? -result : result;
  }

  function sortRows(list) {
    const key = sortState.key || "distanceToEntry";
    const dir = sortState.dir || "asc";

    return [...list].sort((a, b) => {
      const primary = compareSortValues(sortValue(a, key), sortValue(b, key), dir);
      if (primary !== 0) return primary;

      // Вторичная сортировка всегда полезная:
      // если значения равны, выше строка ближе ко входу, потом больше объем, потом выше потенциал.
      return (
        Number(a.metrics?.absDistanceToEntryPct || 0) - Number(b.metrics?.absDistanceToEntryPct || 0) ||
        Number(b.volume24h || 0) - Number(a.volume24h || 0) ||
        Number(b.metrics?.potentialToTakePct || 0) - Number(a.metrics?.potentialToTakePct || 0)
      );
    });
  }

  function jobLimitForSettings(settings) {
    if (settings.timeframes.some((tf) => ["1m", "3m", "5m"].includes(tf))) return 6;
    if (settings.timeframes.length >= 3) return 8;
    if (settings.timeframes.length === 2) return 10;
    return 12;
  }
  function cleanRadarErrorMessage(message) {
    const text = String(message || "");
    if (text.includes("Worker exceeded resource limits") || text.includes("cf-error-code") || text.includes("<!DOCTYPE html>")) {
      return "Cloudflare остановил сканер из-за лимита ресурсов. Уже найденные результаты оставлены на экране.";
    }
    return text.slice(0, 260);
  }
  function settings() { return { timeframes:[...document.querySelectorAll('[name="radar-tf"]:checked')].map((x) => x.value), exchanges:[...document.querySelectorAll('[name="radar-exchange"]:checked')].map((x) => x.value), entryFib:clamp($("entry-fib-number").value, .3, .99, .5), averageCount:Number($("average-count").value), avgFibs:[...document.querySelectorAll('[data-avg-fib]')].map((x) => Number(x.value)).filter(Number.isFinite), minTurnover24h:Number($("min-turnover-24h")?.value || 1000000) }; }
  function recalcRows() { const s = settings(); const recalculated = rawRows.map((row) => { const levels = buildRadarLevels(row.range, s), price = Number(row.price), distanceToEntryPct = ((price - levels.entry.value) / levels.entry.value) * 100, absDistanceToEntryPct = Math.abs(distanceToEntryPct), potentialToTakePct = ((levels.take.value - price) / price) * 100; return { ...row, levels, chartLevels:chartLevels(levels), metrics:{ ...row.metrics, distanceToEntryPct, absDistanceToEntryPct, potentialToTakePct, status:status(price, levels, absDistanceToEntryPct) } }; }); rows = sortRows(recalculated); if (!selectedId && rows[0]) selectedId = rows[0].id; if (selectedId && !rows.some((r) => r.id === selectedId)) selectedId = rows[0]?.id || null; }
  function renderSettings() {
    $("timeframe-checks").innerHTML = TFS.map((tf) => `<label><input type="checkbox" name="radar-tf" value="${tf}" ${tf === "4h" ? "checked" : ""}>${tf}</label>`).join("");
    $("exchange-checks").innerHTML = EXCHANGES.map((exchange) => `
      <label class="${exchange.enabled ? "" : "disabled"}" title="${exchange.enabled ? "" : "Биржа будет подключена позже"}">
        <input
          type="checkbox"
          name="radar-exchange"
          value="${exchange.id}"
          ${exchange.checked ? "checked" : ""}
          ${exchange.enabled ? "" : "disabled"}
        >
        <span>${exchange.label}</span>
        ${exchange.note ? `<small>${exchange.note}</small>` : ""}
      </label>
    `).join("");
    renderAvgInputs();
  }
  function renderAvgInputs() { const count = Number($("average-count")?.value || 3); $("average-fibs").innerHTML = defaults.avgFibs.map((fib, i) => `<label class="${i >= count ? "muted" : ""}">Уср. ${i + 1}<input data-avg-fib type="number" step="0.1" min="0.1" max="5" value="${fib}" ${i >= count ? "disabled" : ""}></label>`).join(""); }
  function renderKpis() { const nearest = rows[0], avg = rows.length ? rows.reduce((s, r) => s + r.metrics.absDistanceToEntryPct, 0) / rows.length : NaN, best = rows.reduce((b, r) => !b || r.metrics.potentialToTakePct > b.metrics.potentialToTakePct ? r : b, null); $("radar-kpis").innerHTML = [["Найдено диапазонов", rows.length], ["Ближайший вход", nearest ? `${nearest.ticker} ${nearest.timeframe}` : "—"], ["Среднее расстояние", pct(avg)], ["Лучший потенциал", best ? pct(best.metrics.potentialToTakePct) : "—"], ["Последнее обновление", lastUpdated ? new Date(lastUpdated).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" }) : "—"]].map(([k, v]) => `<article><span>${k}</span><strong>${v}</strong></article>`).join(""); }

  function radarIconKey(ticker) {
    const key = String(ticker || "").toUpperCase();

    const map = {
      BTC:"bitcoin",
      ETH:"ethereum",
      BNB:"bnb",
      SOL:"solana",
      LINK:"chainlink",
      DOGE:"dogecoin",
      PEPE:"pepe",
      MNT:"mantle",
      NEAR:"near",
      HYPE:"hyperliquid",
      PENDLE:"pendle",
      CRV:"curve"
    };

    return map[key] || key.toLowerCase();
  }

  function radarCoinIconHtml(row) {
    const ticker = String(row?.ticker || "").toUpperCase();
    const key = radarIconKey(ticker);

    const localIcons = {
      bitcoin:`<span class="brand-letter bitcoin-letter">₿</span>`,
      ethereum:`<svg viewBox="0 0 256 417" aria-hidden="true"><path class="eth-top-left" d="M127.9 0L125.1 9.5v274.2l2.8 2.8 127.9-75.6z"/><path class="eth-top-right" d="M127.9 0L0 210.9l127.9 75.6V154.1z"/><path class="eth-bottom-left" d="M127.9 310.7l-1.6 1.9v98.2l1.6 4.7 128-180.3z"/><path class="eth-bottom-right" d="M127.9 415.5V310.7L0 235.2z"/><path class="eth-center-left" d="M127.9 286.5l127.9-75.6-127.9-56.8z"/><path class="eth-center-right" d="M0 210.9l127.9 75.6V154.1z"/></svg>`,
      solana:`<svg viewBox="0 0 128 104" aria-hidden="true"><defs><linearGradient id="radar-sol-g" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#9945ff"/><stop offset="1" stop-color="#14f195"/></linearGradient></defs><path fill="url(#radar-sol-g)" d="M25 0h91l-13 17H12zM12 43h91l13 17H25zM25 86h91l-13 17H12z"/></svg>`,
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

    const remote = row?.iconUrl
      ? `<img src="${escapeHtml(row.iconUrl)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`
      : "";

    const fallback = `<span class="radar-coin-fallback">${escapeHtml(ticker.slice(0, 3) || "•")}</span>`;

    return `<span class="radar-coin-icon">${localIcons[key] || fallback}${remote}</span>`;
  }
  function renderTable() { if (!rows.length && rawRows.length) $("radar-state").textContent = "Бычьи диапазоны по выбранным настройкам не найдены."; $("radar-rows").innerHTML = rows.map((r) => `<tr data-row-id="${r.id}" class="${r.id === selectedId ? "active" : ""}"><td><div class="radar-coin">${radarCoinIconHtml(r)}<b>${r.ticker}</b><span>${r.name || ""}</span></div></td><td>${r.timeframe}</td><td>${r.exchange}</td><td>${money(r.price)}</td><td class="${hasNumber(r.change24hPct) ? (Number(r.change24hPct) >= 0 ? "pos" : "neg") : ""}">${pct(r.change24hPct)}</td><td>${pct(r.metrics.distanceToEntryPct)}</td><td>${pct(r.metrics.rangePct)}</td><td>${money(r.levels.entry.value)}</td><td>${money(r.levels.averages[0]?.value)}</td><td>${money(r.levels.averages[1]?.value)}</td><td>${money(r.levels.averages[2]?.value)}</td><td>${money(r.levels.take.value)}</td><td>${pct(r.metrics.potentialToTakePct)}</td><td>${compact(r.volume24h)}</td><td><span class="radar-status ${statusClass(r.metrics.status)}">${r.metrics.status}</span></td><td class="radar-row-actions"><button data-show="${r.id}">Показать график</button><a href="/trade-plan/?slug=${encodeURIComponent(r.slug)}">Торговый план</a><a href="/reports/?slug=${encodeURIComponent(r.slug)}">Отчет</a></td></tr>`).join(""); }
  function renderChart() { const row = rows.find((r) => r.id === selectedId) || rows[0]; if (!row || !window.LightweightCharts || !window.TradePlanChart) { $("selected-title").textContent = "График выбранной монеты"; $("selected-meta").textContent = "Запустите сканер и выберите найденный диапазон."; $("radar-chart").innerHTML = ""; chart = null; lastChartKey = null; return; } selectedId = row.id; $("selected-title").textContent = `${row.ticker} · ${row.timeframe}`; $("selected-meta").textContent = `${row.exchange} · ${row.symbol} · вход ${money(row.levels.entry.value)} · тейк ${money(row.levels.take.value)}`; const opts = { candles:row.candles, range:row.range, levels:row.chartLevels, timeframe:row.timeframe, symbol:row.ticker, ticker:row.ticker, exchange:row.exchange, slug:row.slug, iconHtml:row.iconUrl ? `<img src="${row.iconUrl}" alt="" style="width:18px;height:18px;border-radius:50%">` : "", showPlan:true }; const chartKey = `${row.id}:${row.timeframe}:${row.exchange}`; const preserveView = chartKey === lastChartKey; lastChartKey = chartKey; if (chart) chart.setData(opts, { preserveView }); else chart = new window.TradePlanChart($("radar-chart"), opts); }
  function renderSortHeaders() {
    document.querySelectorAll(".radar-table th[data-sort]").forEach((th) => {
      const key = th.dataset.sort;
      const active = key === sortState.key;

      th.classList.toggle("is-sortable", true);
      th.classList.toggle("is-sorted", active);
      th.dataset.sortDir = active ? sortState.dir : "";

      const baseText = th.dataset.label || th.textContent.replace(/[▲▼]/g, "").trim();
      th.dataset.label = baseText;

      th.innerHTML = `<span>${escapeHtml(baseText)}</span><b aria-hidden="true">${active ? (sortState.dir === "asc" ? "▲" : "▼") : ""}</b>`;
    });
  }
  function renderAll() { recalcRows(); renderKpis(); renderTable(); renderChart(); renderSortHeaders(); }
  async function scan() {
    const s = settings();
    if (!s.timeframes.length || !s.exchanges.length) return;

    if (s.timeframes.length > 3) {
      $("radar-state").textContent = "Выбрано слишком много таймфреймов. Оставьте 1–3 ТФ для быстрого сканирования.";
      return;
    }

    const generation = ++scanGeneration;
    isScanning = true;

    rawRows = [];
    rows = [];
    selectedId = null;
    lastChartKey = null;

    $("radar-rows").innerHTML = "";
    $("radar-state").textContent = "Сканируем бычьи диапазоны: проверяем первые монеты...";
    renderKpis();
    renderTable();

    let jobOffset = 0;
    const jobLimit = jobLimitForSettings(s);
    const summaryTotal = {};
    let checkedTotal = 0;

    try {
      while (isScanning && generation === scanGeneration) {
        const params = new URLSearchParams({
          timeframes:s.timeframes.join(","),
          entryFib:s.entryFib,
          avgFibs:s.avgFibs.slice(0, s.averageCount).join(","),
          exchanges:s.exchanges.join(","),
          limit:"100",
          debug:"1",
          includeMarket:"0",
          rangeMode:"active",
          universe:"bybit",
          maxUniverse:"1000",
          minTurnover24h:String(s.minTurnover24h),
          jobOffset:String(jobOffset),
          jobLimit:String(jobLimit),
        });

        const res = await fetch(`/api/bull-radar?${params}`, { cache:"no-store" });
        const text = await res.text();

        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw:text };
        }

        if (!res.ok) {
          const detail = data.message || data.error || data.raw || `HTTP ${res.status}`;
          const error = new Error(detail);
          error.status = res.status;
          error.payload = data;
          throw error;
        }

        const batchRows = Array.isArray(data.results) ? data.results : [];

        for (const row of batchRows) {
          if (!rawRows.some((item) => item.id === row.id)) {
            rawRows.push(row);
          }
        }

        Object.entries(data.summary || {}).forEach(([key, value]) => {
          summaryTotal[key] = (summaryTotal[key] || 0) + Number(value || 0);
        });

        lastUpdated = data.updated_at || new Date().toISOString();

        if (!selectedId && rawRows[0]) {
          selectedId = rawRows[0].id;
        }

        renderAll();

        const progress = data.progress || {};
        const checked = progress.nextJobOffset || rawRows.length;
        checkedTotal = checked;
        const total = progress.totalJobs || "?";

        $("radar-state").textContent =
          `Сканируем Bybit: проверено ${checked} из ${total} задач. ` +
          `Фильтр объема: ${compact(s.minTurnover24h)}+. ` +
          `Найдено: ${rawRows.length}. ` +
          `Медвежьих: ${summaryTotal.bearish_range || 0}, ` +
          `нет пары/свечей: ${summaryTotal.no_candles || 0}, ` +
          `ошибок: ${summaryTotal.error || 0}.`;

        if (progress.done) break;

        jobOffset = progress.nextJobOffset || (jobOffset + jobLimit);

        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      isScanning = false;

      if (generation !== scanGeneration) return;

      if (!rawRows.length) {
        $("radar-state").textContent =
          `Бычьи диапазоны не найдены. Проверено: ${checkedTotal}. ` +
          `Фильтр объема: ${compact(s.minTurnover24h)}+. ` +
          `Медвежьих: ${summaryTotal.bearish_range || 0}, ` +
          `нет пары/свечей: ${summaryTotal.no_candles || 0}, ` +
          `ошибок: ${summaryTotal.error || 0}.`;
      } else {
        $("radar-state").textContent =
          `Сканер завершен. Bybit проверен. ` +
          `Фильтр объема: ${compact(s.minTurnover24h)}+. ` +
          `Найдено бычьих диапазонов: ${rawRows.length}.`;
      }

      renderAll();
    } catch (e) {
      isScanning = false;
      console.error(e);
      const statusText = e.status ? `HTTP ${e.status}. ` : "";
      $("radar-state").textContent = e.message?.includes("слишком много таймфреймов")
        ? "Выбрано слишком много таймфреймов. Оставьте 1–3 ТФ для быстрого сканирования."
        : `${statusText}Не удалось загрузить радар: ${cleanRadarErrorMessage(e.message || "попробуйте обновить.")}`;
      if (rawRows.length) {
        $("radar-state").textContent += " Таблица не очищена.";
        renderAll();
      } else {
        rows = [];
        renderKpis();
        renderTable();
        renderChart();
      }
    }
  }
  renderSettings();
  $("entry-fib-range").addEventListener("input", (e) => { $("entry-fib-number").value = Number(e.target.value).toFixed(2); renderAll(); });
  $("entry-fib-number").addEventListener("input", (e) => { const v = clamp(e.target.value, .3, .99, .5); $("entry-fib-range").value = v; renderAll(); });
  $("average-count").addEventListener("change", () => { renderAvgInputs(); renderAll(); });
  document.addEventListener("input", (e) => { if (e.target.matches("[data-avg-fib]")) renderAll(); });
  document.querySelectorAll("[data-tf-preset]").forEach((button) => button.addEventListener("click", () => { const set = new Set(button.dataset.tfPreset.split(",")); document.querySelectorAll('[name="radar-tf"]').forEach((x) => x.checked = set.has(x.value)); if (button.dataset.tfPreset.includes("1m")) { $("radar-state").textContent = "Скальпинг проверяется маленькими батчами, чтобы не упереться в лимиты Cloudflare."; } }));
  $("radar-settings").addEventListener("submit", (e) => { e.preventDefault(); scan(); });
  $("refresh-radar").addEventListener("click", scan);
  $("stop-radar")?.addEventListener("click", () => {
    isScanning = false;
    scanGeneration += 1;
    $("radar-state").textContent = "Сканирование остановлено. Уже найденные результаты оставлены в таблице.";
  });
  $("radar-rows").addEventListener("click", (e) => { if (e.target.closest("a")) return; const tr = e.target.closest("tr[data-row-id]"); if (!tr) return; selectedId = tr.dataset.rowId; renderTable(); renderChart(); });
  document.querySelector(".radar-table thead")?.addEventListener("click", (event) => {
    const th = event.target.closest("th[data-sort]");
    if (!th) return;

    const key = th.dataset.sort;

    if (sortState.key === key) {
      sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
    } else {
      sortState = {
        key,
        dir: sortInitialDir(key),
      };
    }

    renderAll();
  });
  renderKpis();
  renderSortHeaders();
})();
