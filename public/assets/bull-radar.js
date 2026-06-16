(function () {
  const TFS = ["1m", "3m", "5m", "15m", "1h", "4h", "1d", "1w", "1M"];
  const EXCHANGES = [["BYBIT", "Bybit"], ["BINANCE", "Binance"], ["GATEIO", "Gate.io"]];
  const defaults = { avgFibs:[1, 1.5, 2] };
  let rawRows = [], rows = [], selectedId = null, chart = null, lastUpdated = null, lastChartKey = null;
  const $ = (id) => document.getElementById(id);
  const hasNumber = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const money = (v) => hasNumber(v) ? new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", maximumFractionDigits:Number(v) < 1 ? 6 : 2 }).format(Number(v)) : "—";
  const pct = (v) => hasNumber(v) ? `${Number(v) >= 0 ? "+" : ""}${Number(v).toFixed(2)}%` : "—";
  const compact = (v) => hasNumber(v) ? new Intl.NumberFormat("ru-RU", { notation:"compact", maximumFractionDigits:1 }).format(Number(v)) : "—";
  const clamp = (v, min, max, fallback) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback;

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
  function settings() { return { timeframes:[...document.querySelectorAll('[name="radar-tf"]:checked')].map((x) => x.value), exchanges:[...document.querySelectorAll('[name="radar-exchange"]:checked')].map((x) => x.value), entryFib:clamp($("entry-fib-number").value, .3, .99, .5), averageCount:Number($("average-count").value), avgFibs:[...document.querySelectorAll('[data-avg-fib]')].map((x) => Number(x.value)).filter(Number.isFinite) }; }
  function recalcRows() { const s = settings(); rows = rawRows.map((row) => { const levels = buildRadarLevels(row.range, s), price = Number(row.price), distanceToEntryPct = ((price - levels.entry.value) / levels.entry.value) * 100, absDistanceToEntryPct = Math.abs(distanceToEntryPct), potentialToTakePct = ((levels.take.value - price) / price) * 100; return { ...row, levels, chartLevels:chartLevels(levels), metrics:{ ...row.metrics, distanceToEntryPct, absDistanceToEntryPct, potentialToTakePct, status:status(price, levels, absDistanceToEntryPct) } }; }).sort((a, b) => a.metrics.absDistanceToEntryPct - b.metrics.absDistanceToEntryPct || (b.volume24h || 0) - (a.volume24h || 0) || b.metrics.potentialToTakePct - a.metrics.potentialToTakePct); if (!selectedId && rows[0]) selectedId = rows[0].id; if (selectedId && !rows.some((r) => r.id === selectedId)) selectedId = rows[0]?.id || null; }
  function renderSettings() {
    $("timeframe-checks").innerHTML = TFS.map((tf) => `<label><input type="checkbox" name="radar-tf" value="${tf}" ${tf === "4h" ? "checked" : ""}>${tf}</label>`).join("");
    $("exchange-checks").innerHTML = EXCHANGES.map(([id, label]) => `<label><input type="checkbox" name="radar-exchange" value="${id}" checked>${label}</label>`).join("");
    renderAvgInputs();
  }
  function renderAvgInputs() { const count = Number($("average-count")?.value || 3); $("average-fibs").innerHTML = defaults.avgFibs.map((fib, i) => `<label class="${i >= count ? "muted" : ""}">Уср. ${i + 1}<input data-avg-fib type="number" step="0.1" min="0.1" max="5" value="${fib}" ${i >= count ? "disabled" : ""}></label>`).join(""); }
  function renderKpis() { const nearest = rows[0], avg = rows.length ? rows.reduce((s, r) => s + r.metrics.absDistanceToEntryPct, 0) / rows.length : NaN, best = rows.reduce((b, r) => !b || r.metrics.potentialToTakePct > b.metrics.potentialToTakePct ? r : b, null); $("radar-kpis").innerHTML = [["Найдено диапазонов", rows.length], ["Ближайший вход", nearest ? `${nearest.ticker} ${nearest.timeframe}` : "—"], ["Среднее расстояние", pct(avg)], ["Лучший потенциал", best ? pct(best.metrics.potentialToTakePct) : "—"], ["Последнее обновление", lastUpdated ? new Date(lastUpdated).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" }) : "—"]].map(([k, v]) => `<article><span>${k}</span><strong>${v}</strong></article>`).join(""); }
  function renderTable() { $("radar-state").textContent = rows.length ? "" : (rawRows.length ? "Бычьи диапазоны по выбранным настройкам не найдены." : $("radar-state").textContent); $("radar-rows").innerHTML = rows.map((r) => `<tr data-row-id="${r.id}" class="${r.id === selectedId ? "active" : ""}"><td><div class="radar-coin">${r.iconUrl ? `<img src="${r.iconUrl}" alt="">` : ""}<b>${r.ticker}</b><span>${r.name || ""}</span></div></td><td>${r.timeframe}</td><td>${r.exchange}</td><td>${money(r.price)}</td><td class="${hasNumber(r.change24hPct) ? (Number(r.change24hPct) >= 0 ? "pos" : "neg") : ""}">${pct(r.change24hPct)}</td><td>${pct(r.metrics.distanceToEntryPct)}</td><td>${pct(r.metrics.rangePct)}</td><td>${money(r.levels.entry.value)}</td><td>${money(r.levels.averages[0]?.value)}</td><td>${money(r.levels.averages[1]?.value)}</td><td>${money(r.levels.averages[2]?.value)}</td><td>${money(r.levels.take.value)}</td><td>${pct(r.metrics.potentialToTakePct)}</td><td>${compact(r.volume24h)}</td><td>${compact(r.marketCap)}</td><td><span class="radar-status">${r.metrics.status}</span></td><td class="radar-row-actions"><button data-show="${r.id}">Показать график</button><a href="/trade-plan/?slug=${encodeURIComponent(r.slug)}">Торговый план</a><a href="/reports/?slug=${encodeURIComponent(r.slug)}">Отчет</a></td></tr>`).join(""); }
  function renderChart() { const row = rows.find((r) => r.id === selectedId) || rows[0]; if (!row || !window.LightweightCharts || !window.TradePlanChart) { $("selected-title").textContent = "График выбранной монеты"; return; } selectedId = row.id; $("selected-title").textContent = `${row.ticker} · ${row.timeframe}`; $("selected-meta").textContent = `${row.exchange} · ${row.symbol} · вход ${money(row.levels.entry.value)} · тейк ${money(row.levels.take.value)}`; const opts = { candles:row.candles, range:row.range, levels:row.chartLevels, timeframe:row.timeframe, symbol:row.ticker, ticker:row.ticker, exchange:row.exchange, slug:row.slug, iconHtml:row.iconUrl ? `<img src="${row.iconUrl}" alt="" style="width:18px;height:18px;border-radius:50%">` : "", showPlan:true }; const chartKey = `${row.id}:${row.timeframe}:${row.exchange}`; const preserveView = chartKey === lastChartKey; lastChartKey = chartKey; if (chart) chart.setData(opts, { preserveView }); else chart = new window.TradePlanChart($("radar-chart"), opts); }
  function renderAll() { recalcRows(); renderKpis(); renderTable(); renderChart(); }
  async function scan() {
    const s = settings();
    if (!s.timeframes.length || !s.exchanges.length) return;
    if (s.timeframes.length > 3) {
      $("radar-state").textContent = "Выбрано слишком много таймфреймов. Оставьте 1–3 ТФ для быстрого сканирования.";
      return;
    }
    $("radar-state").textContent = "Сканируем бычьи диапазоны...";
    $("radar-rows").innerHTML = "";
    const params = new URLSearchParams({ timeframes:s.timeframes.join(","), entryFib:s.entryFib, avgFibs:s.avgFibs.slice(0, s.averageCount).join(","), exchanges:s.exchanges.join(","), limit:"100", debug:"1", light:"1", includeMarket:"1", rangeMode:"active" });
    try {
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
      rawRows = data.results || [];
      selectedId = rawRows[0]?.id || null;
      lastUpdated = data.updated_at || new Date().toISOString();
      if (!rawRows.length) {
        const summary = data.summary || {};
        const attempts = data.debug?.attempts || [];
        if (attempts.length) console.table(attempts);
        $("radar-state").textContent =
          `Бычьи диапазоны не найдены. Проверено: ${attempts.length || Object.values(summary).reduce((a, b) => a + b, 0)}. ` +
          `Медвежьих: ${summary.bearish_range || 0}, ` +
          `без диапазона: ${summary.no_range || 0}, ` +
          `без свечей: ${summary.no_candles || 0}, ` +
          `ошибок: ${summary.error || 0}.`;
      }
      renderAll();
    } catch (e) {
      console.error(e);
      const status = e.status ? `HTTP ${e.status}. ` : "";
      $("radar-state").textContent = e.message?.includes("слишком много таймфреймов")
        ? "Выбрано слишком много таймфреймов. Оставьте 1–3 ТФ для быстрого сканирования."
        : `${status}Не удалось загрузить радар: ${e.message || "попробуйте обновить."}`;
      if (rawRows.length) {
        $("radar-state").textContent += " Предыдущие результаты оставлены на экране.";
      } else {
        rows = [];
        renderKpis();
        renderTable();
      }
    }
  }
  renderSettings();
  $("entry-fib-range").addEventListener("input", (e) => { $("entry-fib-number").value = Number(e.target.value).toFixed(2); renderAll(); });
  $("entry-fib-number").addEventListener("input", (e) => { const v = clamp(e.target.value, .3, .99, .5); $("entry-fib-range").value = v; renderAll(); });
  $("average-count").addEventListener("change", () => { renderAvgInputs(); renderAll(); });
  document.addEventListener("input", (e) => { if (e.target.matches("[data-avg-fib]")) renderAll(); });
  document.querySelectorAll("[data-tf-preset]").forEach((button) => button.addEventListener("click", () => { const set = new Set(button.dataset.tfPreset.split(",")); document.querySelectorAll('[name="radar-tf"]').forEach((x) => x.checked = set.has(x.value)); }));
  $("radar-settings").addEventListener("submit", (e) => { e.preventDefault(); scan(); });
  $("refresh-radar").addEventListener("click", scan);
  $("radar-rows").addEventListener("click", (e) => { if (e.target.closest("a")) return; const tr = e.target.closest("tr[data-row-id]"); if (!tr) return; selectedId = tr.dataset.rowId; renderTable(); renderChart(); });
  renderKpis();
})();
