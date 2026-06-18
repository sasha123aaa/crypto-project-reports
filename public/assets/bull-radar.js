(function () {
  const TFS = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];
  const EXCHANGES = [
    { id:"BYBIT", label:"Bybit", enabled:true, checked:true },
    { id:"BINANCE", label:"Binance", enabled:false, checked:false, note:"в разработке" },
    { id:"GATEIO", label:"Gate.io", enabled:false, checked:false, note:"в разработке" },
  ];
  const RADAR_PREFS_KEY = "bullRadar:prefs:v1";
  const RADAR_BLACKLIST_KEY = "bullRadar:blacklist:v1";
  const RADAR_CHART_REFRESH_MS = 60_000;
  let rawRows = [], rows = [], selectedId = null, chart = null, lastUpdated = null, lastChartKey = null;
  let strategyRadarStats = {};
  let sortState = { key: "distanceToEntryAbs", dir: "asc" };
  let scanGeneration = 0;
  let isScanning = false;
  let autoRefreshTimer = null;
  let nextAutoRefreshAt = null;
  let activeScanController = null;
  let selectedChartRefreshTimer = null;
  let selectedChartRefreshAt = null;
  let selectedChartRefreshing = false;
  let selectedChartController = null;
  let radarBlacklist = new Set();
  const $ = (id) => document.getElementById(id);
  const hasNumber = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const money = (v) => hasNumber(v) ? new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:Number(v) < 1 ? 6 : 2 }).format(Number(v)) : "—";
  const pct = (v) => hasNumber(v) ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";
  const compact = (v) => hasNumber(v) ? new Intl.NumberFormat("ru-RU", { notation:"compact", maximumFractionDigits:1 }).format(Number(v)) : "—";
  const clamp = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function readJsonStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJsonStorage(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // storage best-effort
    }
  }

  radarBlacklist = new Set(readJsonStorage(RADAR_BLACKLIST_KEY, []));

  function selectedRadarStrategyMode() {
    return $("radar-strategy-mode")?.value || "auto";
  }

  function resolveRadarStrategyMode(row) {
    const selected = selectedRadarStrategyMode();
    if (selected !== "auto") return Number(selected);
    const stats = rowStrategyStats(row);
    if (Number.isFinite(Number(stats?.bestEntryMode))) return Number(stats.bestEntryMode);
    return 0.31;
  }

  function buildRadarStrategyPreview(row) {
    const entryMode = resolveRadarStrategyMode(row);
    const engine = window.StrategyEngine;
    if (!engine?.calculateLevels || !engine?.buildStrategyPlan) return null;
    const levels = engine.calculateLevels({ range:row.range, entryMode });
    const plan = engine.buildStrategyPlan({ range:row.range, entryMode, currentPrice:row.price, candles:row.candles || [], capital:100 });
    return {
      sourceType:"plan-preview",
      entryMode,
      currentPrice:row.price,
      levels:plan?.levels || levels,
      levelStates:plan?.levelStates || [],
      activatedLevels:Number(plan?.activatedLevels || 0),
      averagePrice:plan?.averagePrice || null,
      takePrice:plan?.takePrice || null,
      usedCapitalPct:plan?.usedCapitalPct || 0,
      currentPnlPct:plan?.currentPnlPct ?? null,
      maxDrawdownPct:plan?.maxDrawdownPct ?? null,
      status:plan?.status || "waiting_entry",
    };
  }

  function radarStrategyStatus(price, strategy, absDistance) {
    if (absDistance <= 1) return "Готово к входу";
    if (strategy?.activatedLevels > 0) return "Активирована";
    const entry = Number(strategy?.levels?.[0]?.price);
    if (Number.isFinite(entry) && price > entry) return "Выше входа";
    return "Ждем вход";
  }

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
      "nextAverage",
      "strategyMode",
      "activatedLevels",
      "usedCapitalPct",
    ]);

    if (key === "distanceToEntryAbs") return "asc";
    if (key === "distanceToEntry") return "asc";
    if (key === "ticker" || key === "exchange" || key === "timeframe" || key === "status") return "asc";

    return descFirst.has(key) ? "desc" : "asc";
  }

  function rowStrategyStats(row) { return strategyRadarStats?.[String(row?.ticker||"").toUpperCase()]?.[row?.timeframe] || null; }
  function strategyStatsHtml(row) { const st=rowStrategyStats(row); if(!st) return "Истории нет"; if(Number(st.totalTrades||0)<=0&&st.activeTrade) return `Сделок: 1 · Тейков: ${escapeHtml(st.takeHits ?? 0)} · Winrate: ${Number(st.winrate||0).toFixed(0)}% · Активная сделка: ${escapeHtml(st.activeTrade.status||"да")}`; return [`Сделок: ${escapeHtml(st.totalTrades ?? (st.activeTrade ? 1 : 0))}`,`Тейков: ${escapeHtml(st.takeHits ?? 0)}`,`Winrate: ${Number(st.winrate||0).toFixed(0)}%`,`Макс. уср: ${escapeHtml(st.maxActivatedLevels ?? 0)}`,`Ср. просадка: ${pct(st.avgDrawdownPct)}`,`Примерный результат: ${pct(st.estimatedFullCapitalResultPct)}`,`Лучший режим: ${escapeHtml(st.bestEntryMode ?? "—")}`,`Активная сделка: ${st.activeTrade?escapeHtml(st.activeTrade.status||"да"):"нет"}`].filter(Boolean).join(" · "); }
  function mergeStrategyRadarStats(nextStats) { if(!nextStats||typeof nextStats!=="object") return; for(const [symbol, byTf] of Object.entries(nextStats)){ const key=String(symbol||"").toUpperCase(); strategyRadarStats[key]=strategyRadarStats[key]||{}; for(const [tf,value] of Object.entries(byTf||{})){ strategyRadarStats[key][tf]=value; } } }
  async function loadStrategyRadarStatsForRows(list) { const symbols=[...new Set((list||[]).map(row=>String(row.ticker||"").toUpperCase()).filter(Boolean))]; if(!symbols.length) return; const tfs=[...new Set((list||[]).map(row=>row.timeframe).filter(Boolean))]; for(const tf of tfs){ try{ const response=await fetch(`/api/strategy/radar-stats?symbols=${encodeURIComponent(symbols.join(","))}&timeframe=${encodeURIComponent(tf)}&_=${Date.now()}`,{cache:"no-store"}); const payload=await response.json().catch(()=>({})); if(payload?.stats) mergeStrategyRadarStats(payload.stats); }catch(error){ console.warn("Strategy radar stats unavailable", error); } } }

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

      case "distanceToEntryAbs":
        return Number(row.metrics?.absDistanceToEntryPct);

      case "distanceToEntry":
        return Number(row.metrics?.distanceToEntryPct);

      case "rangePct":
        return Number(row.metrics?.rangePct);

      case "entry":
        return Number(row.levels?.entry?.value);

      case "strategyMode":
        return Number(row.strategyMode);

      case "nextAverage":
        return Number(row.levels?.nextAverage?.value);

      case "activatedLevels":
        return Number(row.strategy?.activatedLevels || 0);

      case "usedCapitalPct":
        return Number(row.strategy?.usedCapitalPct || 0);

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
    const key = sortState.key || "distanceToEntryAbs";
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
  function settings() {
    return {
      timeframes:[...document.querySelectorAll('[name="radar-tf"]:checked')].map((x) => x.value),
      exchanges:[...document.querySelectorAll('[name="radar-exchange"]:checked')].map((x) => x.value),
      strategyMode:$("radar-strategy-mode")?.value || "auto",
      minTurnover24h:Number($("min-turnover-24h")?.value || 1000000),
    };
  }
  function currentRadarPreferences() { const s = settings(); return { timeframes:s.timeframes, strategyMode:s.strategyMode, minTurnover24h:s.minTurnover24h, sortState, autoRefresh:$("radar-auto-refresh")?.value || "off" }; }
  function saveRadarPreferences() { writeJsonStorage(RADAR_PREFS_KEY, currentRadarPreferences()); }
  function applyRadarPreferences() { const prefs = readJsonStorage(RADAR_PREFS_KEY, null); if (!prefs) return; if (Array.isArray(prefs.timeframes) && prefs.timeframes.length) { const set = new Set(prefs.timeframes); document.querySelectorAll('[name="radar-tf"]').forEach((input) => { input.checked = set.has(input.value); }); } if ($("radar-strategy-mode") && ["auto", "0.31", "0.5", "0.75"].includes(String(prefs.strategyMode))) $("radar-strategy-mode").value = String(prefs.strategyMode); if (Number.isFinite(Number(prefs.minTurnover24h)) && $("min-turnover-24h")) $("min-turnover-24h").value = String(prefs.minTurnover24h); if (prefs.sortState?.key) sortState = { key:prefs.sortState.key, dir:prefs.sortState.dir === "desc" ? "desc" : "asc" }; if ($("radar-auto-refresh") && prefs.autoRefresh) $("radar-auto-refresh").value = prefs.autoRefresh; }
  function saveRadarBlacklist() { writeJsonStorage(RADAR_BLACKLIST_KEY, [...radarBlacklist]); }
  function renderRadarBlacklist() { const el = $("radar-blacklist"); if (!el) return; if (!radarBlacklist.size) { el.innerHTML = `<span class="radar-blacklist-empty">Скрытых монет нет</span>`; return; } el.innerHTML = [...radarBlacklist].sort().map((ticker) => `<button type="button" data-unhide="${escapeHtml(ticker)}">${escapeHtml(ticker)} <span>×</span></button>`).join(""); }
  function hideTicker(ticker) { const value = String(ticker || "").toUpperCase(); if (!value) return; radarBlacklist.add(value); saveRadarBlacklist(); if (selectedId) { const selectedRow = rawRows.find((row) => row.id === selectedId); if (String(selectedRow?.ticker || "").toUpperCase() === value) selectedId = null; } renderRadarBlacklist(); renderAll(); }
  function unhideTicker(ticker) { const value = String(ticker || "").toUpperCase(); radarBlacklist.delete(value); saveRadarBlacklist(); renderRadarBlacklist(); renderAll(); }
  function recalcRows() { const visibleRows = rawRows.filter((row) => !radarBlacklist.has(String(row.ticker || "").toUpperCase())); const recalculated = visibleRows.map((row) => { const strategy = buildRadarStrategyPreview(row); const entry = strategy?.levels?.[0]; const takePrice = strategy?.takePrice; const nextAverage = (strategy?.levels || []).find((level, index) => index > 0 && index >= Number(strategy.activatedLevels || 0)); const price = Number(row.price); const entryPrice = Number(entry?.price); const distanceToEntryPct = ((price - entryPrice) / entryPrice) * 100; const absDistanceToEntryPct = Math.abs(distanceToEntryPct); const potentialToTakePct = ((Number(takePrice) - price) / price) * 100; return { ...row, strategy, strategyMode:strategy?.entryMode, levels:{ take:{ label:"Тейк", value:takePrice }, entry:{ label:"Вход", value:entryPrice }, nextAverage:nextAverage ? { label:nextAverage.label, value:nextAverage.price } : null }, metrics:{ ...row.metrics, distanceToEntryPct, absDistanceToEntryPct, potentialToTakePct, status:radarStrategyStatus(price, strategy, absDistanceToEntryPct) } }; }); rows = sortRows(recalculated); if (!selectedId && rows[0]) selectedId = rows[0].id; if (selectedId && !rows.some((r) => r.id === selectedId)) selectedId = rows[0]?.id || null; }
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
  }
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
  function selectedRow() { return rows.find((r) => r.id === selectedId) || rows[0] || null; }
  function resetSelectedChartRefreshTimer() {
    clearInterval(selectedChartRefreshTimer);
    selectedChartRefreshTimer = null;
    selectedChartRefreshAt = null;
    const row = selectedRow();
    if (!row) return;
    selectedChartRefreshAt = Date.now() + RADAR_CHART_REFRESH_MS;
    selectedChartRefreshTimer = setInterval(() => {
      const current = selectedRow();
      if (!current || isScanning) return;
      const remaining = Math.max(0, Math.ceil((selectedChartRefreshAt - Date.now()) / 1000));
      const meta = $("selected-meta");
      if (meta && !selectedChartRefreshing && remaining > 0) {
        meta.textContent = `${current.exchange} · ${current.symbol} · вход ${money(current.levels.entry.value)} · тейк ${money(current.levels.take.value)} · обновление через ${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
      }
      if (remaining <= 0 && !selectedChartRefreshing) refreshSelectedChart();
    }, 1000);
  }
  async function refreshSelectedChart() {
    const row = selectedRow();
    if (!row || selectedChartRefreshing) return;
    selectedChartRefreshing = true;
    selectedChartController?.abort();
    const controller = new AbortController();
    selectedChartController = controller;
    try {
      const params = new URLSearchParams({ symbol:row.symbol, exchange:row.exchange || "BYBIT", timeframe:row.timeframe, _:String(Date.now()) });
      const response = await fetch(`/api/radar-chart-candles?${params.toString()}`, { cache:"no-store", signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.reason || `HTTP ${response.status}`);
      const nextCandles = Array.isArray(data.candles) ? data.candles : [];
      const nextRange = data.range || null;
      if (!nextRange || nextRange.bullish !== true) {
        rawRows = rawRows.filter((item) => item.id !== row.id);
        if (selectedId === row.id) selectedId = null;
        $("radar-state").textContent = `${row.ticker} ${row.timeframe}: бычий диапазон больше не активен. Строка убрана из радара.`;
        await loadStrategyRadarStatsForRows(rawRows);
        renderAll();
        resetSelectedChartRefreshTimer();
        return;
      }
      const updatedLast = nextCandles[nextCandles.length - 1];
      const nextPrice = Number(updatedLast?.close);
      rawRows = rawRows.map((item) => item.id !== row.id ? item : { ...item, candles:nextCandles, range:nextRange, price:Number.isFinite(nextPrice) ? nextPrice : item.price });
      lastUpdated = data.updated_at || new Date().toISOString();
      await loadStrategyRadarStatsForRows(rawRows);
      renderAll();
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Radar selected chart refresh failed", error);
        const rowNow = selectedRow();
        if (rowNow) $("selected-meta").textContent = `${rowNow.exchange} · ${rowNow.symbol} · не удалось обновить график`;
      }
    } finally {
      if (selectedChartController === controller) selectedChartController = null;
      selectedChartRefreshing = false;
      selectedChartRefreshAt = Date.now() + RADAR_CHART_REFRESH_MS;
    }
  }
  function tradePlanUrl(row) { const mode = resolveRadarStrategyMode(row); const params = new URLSearchParams({ slug:row.slug || row.ticker, timeframe:row.timeframe, exchange:row.exchange || "BYBIT", strategyMode:String(mode) }); return `/trade-plan/?${params.toString()}`; }
  function renderTable() { if (!rows.length && rawRows.length) $("radar-state").textContent = "Бычьи диапазоны по выбранным настройкам не найдены."; $("radar-rows").innerHTML = rows.map((r) => `<tr data-row-id="${r.id}" class="${r.id === selectedId ? "active" : ""}"><td><div class="radar-coin">${radarCoinIconHtml(r)}<b>${r.ticker}</b><span>${r.name || ""}</span></div></td><td>${r.timeframe}</td><td>${r.exchange}</td><td>${money(r.price)}</td><td class="${hasNumber(r.change24hPct) ? (Number(r.change24hPct) >= 0 ? "pos" : "neg") : ""}">${pct(r.change24hPct)}</td><td>${pct(r.metrics.distanceToEntryPct)}</td><td>${pct(r.metrics.rangePct)}</td><td>${escapeHtml(r.strategyMode || "—")}</td><td>${money(r.levels?.entry?.value)}</td><td>${money(r.levels?.nextAverage?.value)}</td><td>${money(r.levels?.take?.value)}</td><td>${escapeHtml(r.strategy?.activatedLevels ?? 0)}</td><td>${pct(r.strategy?.usedCapitalPct)}</td><td>${pct(r.metrics.potentialToTakePct)}</td><td>${compact(r.volume24h)}</td><td><span class="radar-status ${statusClass(r.metrics.status)}">${r.metrics.status}</span></td>${rowStrategyStats(r)?`<td>${escapeHtml(rowStrategyStats(r).totalTrades ?? (rowStrategyStats(r).activeTrade ? 1 : 0))}</td><td>${escapeHtml(rowStrategyStats(r).takeHits ?? 0)}</td><td>${Number(rowStrategyStats(r).winrate||0).toFixed(0)}%</td><td>${escapeHtml(rowStrategyStats(r).maxActivatedLevels ?? 0)}</td><td>${pct(rowStrategyStats(r).avgDrawdownPct)}</td><td>${pct(rowStrategyStats(r).estimatedFullCapitalResultPct)}</td><td>${escapeHtml(rowStrategyStats(r).bestEntryMode ?? "—")}</td><td>${rowStrategyStats(r).activeTrade?escapeHtml(rowStrategyStats(r).activeTrade.status||"да"):"нет"}</td>`:`<td colspan="8">Истории нет</td>`}<td class="radar-row-actions"><button data-show="${r.id}">Показать график</button><a href="${tradePlanUrl(r)}">Торговый план</a><a href="/reports/?slug=${encodeURIComponent(r.slug)}">Отчет</a><button data-hide="${escapeHtml(r.ticker)}">Скрыть</button></td></tr>`).join(""); }
  function renderChart() { const row = selectedRow(); if (!row || !window.LightweightCharts || !window.TradePlanChart) { $("selected-title").textContent = "График выбранной монеты"; $("selected-meta").textContent = "Запустите сканер и выберите найденный диапазон."; $("radar-chart").innerHTML = ""; chart = null; lastChartKey = null; resetSelectedChartRefreshTimer(); return; } selectedId = row.id; const strategy = row.strategy || buildRadarStrategyPreview(row); $("selected-title").textContent = `${row.ticker} · ${row.timeframe}`; $("selected-meta").textContent = `${row.exchange} · ${row.symbol} · режим ${escapeHtml(strategy?.entryMode || "—")} · вход ${money(row.levels?.entry?.value)} · тейк ${money(row.levels?.take?.value)}`; const opts = { candles:row.candles, range:row.range, levels:{}, activeStrategyTrade:strategy, timeframe:row.timeframe, symbol:row.ticker, ticker:row.ticker, exchange:row.exchange, slug:row.slug, iconHtml:row.iconUrl ? `<img src="${row.iconUrl}" alt="" style="width:18px;height:18px;border-radius:50%">` : "", showPlan:false }; const chartKey = `${row.id}:${row.timeframe}:${row.exchange}`; const previousChartKey = lastChartKey; const preserveView = chartKey === lastChartKey; lastChartKey = chartKey; if (chart) chart.setData(opts, { preserveView }); else chart = new window.TradePlanChart($("radar-chart"), opts); chart?.setActiveStrategyTrade?.(strategy); if (chartKey !== previousChartKey) resetSelectedChartRefreshTimer(); }

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
  function resetDefaultSort() { sortState = { key:"distanceToEntryAbs", dir:"asc" }; renderAll(); saveRadarPreferences(); }
  function updateRadarProgress(checked = 0, total = 0) { const el = $("radar-progress"); if (!el) return; const bar = el.querySelector("span"); const pctValue = total > 0 ? Math.min(100, Math.max(0, (checked / total) * 100)) : 0; el.hidden = false; el.setAttribute("aria-label", `Прогресс сканирования ${Math.round(pctValue)}%`); if (bar) bar.style.width = `${pctValue}%`; }
  function hideRadarProgress() { const el = $("radar-progress"); if (!el) return; el.hidden = true; const bar = el.querySelector("span"); if (bar) bar.style.width = "0%"; }
  function setRadarScanningState(scanning) { const start = $("start-radar"); const refresh = $("refresh-radar"); const stop = $("stop-radar"); if (start) start.disabled = scanning; if (refresh) refresh.disabled = scanning; if (stop) stop.disabled = !scanning; }
  function updateAutoRefreshTimer() { clearInterval(autoRefreshTimer); autoRefreshTimer = null; nextAutoRefreshAt = null; const seconds = Number($("radar-auto-refresh")?.value || 0); if (!Number.isFinite(seconds) || seconds <= 0) return; nextAutoRefreshAt = Date.now() + seconds * 1000; autoRefreshTimer = setInterval(() => { if (!nextAutoRefreshAt) return; const remaining = Math.max(0, Math.ceil((nextAutoRefreshAt - Date.now()) / 1000)); const current = $("radar-state")?.textContent || ""; if (!isScanning && rawRows.length && remaining > 0 && !current.includes("Сканируем")) $("radar-state").textContent = `Автообновление через ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}. Найдено: ${rawRows.length}.`; if (remaining <= 0) { if (!isScanning) scan({ keepRowsUntilFirstBatch:true }); const nextSeconds = Number($("radar-auto-refresh")?.value || 0); nextAutoRefreshAt = nextSeconds > 0 ? Date.now() + nextSeconds * 1000 : null; } }, 1000); }
  async function scan(options = {}) {
    const keepRowsUntilFirstBatch = options.keepRowsUntilFirstBatch === true;
    const s = settings();
    if (!s.timeframes.length || !s.exchanges.length) return;

    if (s.timeframes.length > 3) {
      $("radar-state").textContent = "Выбрано слишком много таймфреймов. Оставьте 1–3 ТФ для быстрого сканирования.";
      return;
    }

    if (isScanning) {
      activeScanController?.abort();
      isScanning = false;
    }

    activeScanController?.abort();
    selectedChartController?.abort();
    selectedChartRefreshing = false;
    const controller = new AbortController();
    activeScanController = controller;

    const generation = ++scanGeneration;
    isScanning = true;
    setRadarScanningState(true);

    if (!keepRowsUntilFirstBatch) {
      rawRows = [];
      rows = [];
      strategyRadarStats = {};
      selectedId = null;
      lastChartKey = null;
      $("radar-rows").innerHTML = "";
      renderKpis();
      renderTable();
    }

    $("radar-state").textContent = "Сканируем бычьи диапазоны: проверяем первые монеты...";
    updateRadarProgress(0, 1);

    let jobOffset = 0;
    const jobLimit = jobLimitForSettings(s);
    const summaryTotal = {};
    let checkedTotal = 0;
    let firstBatchApplied = false;

    try {
      while (isScanning && generation === scanGeneration) {
        const params = new URLSearchParams({
          timeframes:s.timeframes.join(","),
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

        const res = await fetch(`/api/bull-radar?${params}`, { cache:"no-store", signal:controller.signal });

        if (generation !== scanGeneration || controller.signal.aborted) {
          return;
        }

        const text = await res.text();

        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = { raw:text };
        }

        if (generation !== scanGeneration || controller.signal.aborted) {
          return;
        }

        if (!res.ok) {
          const detail = data.message || data.error || data.raw || `HTTP ${res.status}`;
          const error = new Error(detail);
          error.status = res.status;
          error.payload = data;
          throw error;
        }

        const batchRows = Array.isArray(data.results) ? data.results : [];

        if (keepRowsUntilFirstBatch && !firstBatchApplied) {
          rawRows = [];
          rows = [];
          selectedId = null;
          lastChartKey = null;
          firstBatchApplied = true;
        }

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

        await loadStrategyRadarStatsForRows(rawRows);
        renderAll();

        const progress = data.progress || {};
        const checked = progress.nextJobOffset || rawRows.length;
        checkedTotal = checked;
        const total = progress.totalJobs || "?";
        updateRadarProgress(Number(checked), Number(total));

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
      setRadarScanningState(false);
      if (activeScanController === controller) activeScanController = null;

      if (generation !== scanGeneration || controller.signal.aborted) return;

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

      await loadStrategyRadarStatsForRows(rawRows);
      renderAll();
      updateRadarProgress(1, 1);
      setTimeout(hideRadarProgress, 1200);
      updateAutoRefreshTimer();
    } catch (e) {
      const isActiveController = activeScanController === controller;
      if (isActiveController) {
        isScanning = false;
        setRadarScanningState(false);
        activeScanController = null;
      }
      hideRadarProgress();
      if (e?.name === "AbortError") {
        if (generation === scanGeneration) {
          $("radar-state").textContent = rawRows.length
            ? "Сканирование остановлено. Уже найденные результаты оставлены в таблице."
            : "Сканирование остановлено.";
          renderAll();
        }
        return;
      }
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
  applyRadarPreferences();
  renderRadarBlacklist();
  renderSortHeaders();
  updateAutoRefreshTimer();
  setRadarScanningState(false);
  document.addEventListener("change", (event) => { if (event.target.matches('[name="radar-tf"]') || event.target.matches("#radar-strategy-mode") || event.target.matches("#min-turnover-24h") || event.target.matches("#radar-auto-refresh")) { renderAll(); saveRadarPreferences(); updateAutoRefreshTimer(); } });
  document.querySelectorAll("[data-tf-preset]").forEach((button) => button.addEventListener("click", () => { const set = new Set(button.dataset.tfPreset.split(",")); document.querySelectorAll('[name="radar-tf"]').forEach((x) => x.checked = set.has(x.value)); saveRadarPreferences(); if (button.dataset.tfPreset.includes("1m")) { $("radar-state").textContent = "Скальпинг проверяется маленькими батчами, чтобы не упереться в лимиты Cloudflare."; } }));
  $("radar-settings").addEventListener("submit", (e) => { e.preventDefault(); scan(); });
  $("refresh-radar").addEventListener("click", () => scan());
  $("reset-radar-sort")?.addEventListener("click", resetDefaultSort);
  $("stop-radar")?.addEventListener("click", () => {
    isScanning = false;
    scanGeneration += 1;
    activeScanController?.abort();
    activeScanController = null;
    hideRadarProgress();
    setRadarScanningState(false);
    $("radar-state").textContent = "Сканирование остановлено. Уже найденные результаты оставлены в таблице.";
  });
  $("radar-rows").addEventListener("click", (e) => { const hideButton = e.target.closest("[data-hide]"); if (hideButton) { e.preventDefault(); e.stopPropagation(); hideTicker(hideButton.dataset.hide); return; } if (e.target.closest("a")) return; const tr = e.target.closest("tr[data-row-id]"); if (!tr) return; selectedId = tr.dataset.rowId; renderTable(); renderChart(); resetSelectedChartRefreshTimer(); });
  $("radar-blacklist")?.addEventListener("click", (event) => { const button = event.target.closest("[data-unhide]"); if (!button) return; unhideTicker(button.dataset.unhide); });
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
    saveRadarPreferences();
  });
  renderKpis();
  renderSortHeaders();
})();
