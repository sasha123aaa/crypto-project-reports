import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardJs = await readFile(new URL("../public/assets/strategy-dashboard.js", import.meta.url), "utf8");
const siteNavJs = await readFile(new URL("../public/assets/site-nav.js", import.meta.url), "utf8");
const homeHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const appCss = await readFile(new URL("../public/assets/app.css", import.meta.url), "utf8");

test("strategy-dashboard.js contains calls to strategy APIs", () => {
  assert.match(dashboardJs, /\/api\/strategy\/status/);
  assert.match(dashboardJs, /strategyAdminFetch\("\/api\/strategy\/run-monitor",key\)/);
  assert.match(dashboardJs, /\/api\/strategy\/active/);
  assert.match(dashboardJs, /\/api\/strategy\/trades\?status=closed&limit=50/);
  assert.match(dashboardJs, /\/api\/strategy\/stats/);
});

test("navigation contains /strategy/", () => {
  assert.match(siteNavJs, /\/strategy\//);
  assert.match(siteNavJs, /Стратегия/);
  assert.match(homeHtml, /\/strategy\//);
});

const bullRadarJs = await readFile(new URL("../public/assets/bull-radar.js", import.meta.url), "utf8");
const strategyHtml = await readFile(new URL("../public/strategy/index.html", import.meta.url), "utf8");

test("bull radar distinguishes active trades from missing history", () => {
  assert.match(bullRadarJs, /Активная сделка/);
  assert.match(bullRadarJs, /if\(!st\) return "Истории нет"/);
  assert.match(bullRadarJs, /if\(Number\(st\.totalTrades\|\|0\)<=0&&st\.activeTrade\)/);
});

test("strategy dashboard exposes rebuild stats action", () => {
  assert.match(strategyHtml, /strategyRebuildBtn/);
  assert.match(strategyHtml, /Пересобрать статистику/);
  assert.match(dashboardJs, /strategyAdminFetch\("\/api\/strategy\/rebuild-stats",key\)/);
});

test("strategy backfill UI uses safe loop controls", () => {
  assert.match(dashboardJs, /let backfillLoopActive=false/);
  assert.match(dashboardJs, /let backfillLoopAbort=false/);
  assert.match(dashboardJs, /limit:"1"/);
  assert.match(dashboardJs, /maxRuntimeMs:"18000"/);
  assert.match(dashboardJs, /payload\.completed===true\|\|payload\.backfillState\?\.completed===true/);
  assert.doesNotMatch(dashboardJs, /Number\(payload\.offset\|\|0\)===0&&Number\(payload\.totalJobs\|\|0\)>0/);
  assert.match(dashboardJs, /payload\.busy===true/);
  assert.match(dashboardJs, /Cloudflare остановил слишком большую пачку/);
  assert.match(strategyHtml, /strategyBackfillStopBtn/);
  assert.match(strategyHtml, /Остановить/);
});


test("strategy page shows stats before trade tables and completed trades title", () => {
  assert.ok(strategyHtml.indexOf("Статистика стратегии") < strategyHtml.indexOf("Активные сделки"));
  assert.match(strategyHtml, /<h2>Завершённые сделки<\/h2>/);
});

test("strategy trade tables are compact and sticky", () => {
  assert.match(dashboardJs, /strategy-table-active/);
  assert.match(dashboardJs, /strategy-table-closed/);
  assert.match(appCss, /\.strategy-table-active\{max-height:min\(62vh,680px\)\}/);
  assert.match(appCss, /\.strategy-table-closed\{max-height:min\(55vh,560px\)\}/);
  assert.match(appCss, /\.strategy-dashboard-table thead\{position:sticky/);
  assert.match(appCss, /\.strategy-dashboard-table th:first-child,\.strategy-dashboard-table td:first-child\{position:sticky/);
});

test("strategy admin requests use header instead of key query parameter", () => {
  assert.doesNotMatch(dashboardJs, /key=\$\{encodeURIComponent\(key\)\}/);
  assert.doesNotMatch(dashboardJs, /new URLSearchParams\(\{key,/);
  assert.match(dashboardJs, /"x-strategy-admin-key":key/);
});

test("reset backfill history triggers separate stats rebuild and preserves reset success on rebuild failure", () => {
  assert.match(dashboardJs, /strategyAdminFetch\("\/api\/strategy\/reset-backfill-history",key,\{method:"POST"\}\)/);
  assert.match(dashboardJs, /strategyAdminFetch\("\/api\/strategy\/rebuild-stats",key\)/);
  assert.match(dashboardJs, /statsWarning=error\?\.message\|\|String\(error\)/);
  assert.match(dashboardJs, /Статистика пока не пересобрана/);
  assert.match(dashboardJs, /Историческая история сброшена/);
});

test("fetchJson reports HTTP status and HTML preview for non-JSON responses", () => {
  assert.match(dashboardJs, /const raw=await response\.text\(\)/);
  assert.match(dashboardJs, /HTTP \$\{response\.status\}/);
  assert.match(dashboardJs, /Сервер вернул не JSON/);
  assert.match(dashboardJs, /Ответ: \$\{preview\}/);
  assert.doesNotMatch(dashboardJs, /Некорректный JSON/);
});

test("strategy UI distinguishes live monitor and historical backfill progress", () => {
  assert.match(strategyHtml, /Прогресс live-монитора/);
  assert.match(strategyHtml, /Прогресс исторического прогона/);
  assert.match(strategyHtml, /Live-монитор постоянно проверяет текущий рынок/);
  assert.match(strategyHtml, /Их прогресс не связан между собой/);
});

test("completed trades table shows averaging count column", async () => {
  const dashboardJs = await import("node:fs/promises").then(fs => fs.readFile("public/assets/strategy-dashboard.js", "utf8"));
  assert.match(dashboardJs, /function averagingCount\(trade\)/);
  assert.match(dashboardJs, /"Усреднений"/);
  assert.match(dashboardJs, /fmtNum\(averagingCount\(t\),0\)/);
});

test("strategy page shows overlapping live trades audit metric", async () => {
  const html = await import("node:fs/promises").then(fs => fs.readFile("public/strategy/index.html", "utf8"));
  assert.match(html, /Наложенных live-сделок/);
  assert.match(html, /strategyOverlappingLiveGroups/);
});

test("strategy summary UI is present between stats and trade tables", () => {
  assert.ok(strategyHtml.indexOf("Статистика стратегии") < strategyHtml.indexOf("Сводка по монетам и стратегиям"));
  assert.ok(strategyHtml.indexOf("Сводка по монетам и стратегиям") < strategyHtml.indexOf("Активные сделки"));
  assert.ok(strategyHtml.indexOf("Активные сделки") < strategyHtml.indexOf("Завершённые сделки"));
  assert.match(strategyHtml, /strategySummarySearch/);
  assert.match(strategyHtml, /strategySummaryTimeframe/);
  assert.match(strategyHtml, /strategySummaryEntryMode/);
  assert.match(strategyHtml, /strategySummaryMinTrades/);
  assert.match(strategyHtml, /strategySummarySort/);
});

test("strategy summary table renders required columns and labels", () => {
  for (const label of ["Монета","Биржа","ТФ","Режим","Сделок","Тейков","Завершено тейком","Активных","Общий результат","Баланс после закрытых","Баланс сейчас","Средний результат позиции","Лучший результат","Макс. усреднений","Средняя просадка","Макс. просадка","Средний капитал","Выборка"]) {
    assert.match(dashboardJs, new RegExp(label.replace("$", "\\$")));
  }
  assert.doesNotMatch(dashboardJs, /Winrate/);
  assert.match(dashboardJs, /Расчёт ведётся от начального виртуального капитала \$1 000/);
  assert.match(dashboardJs, /Баланс после закрытых учитывает только зафиксированный результат/);
  assert.match(dashboardJs, /Баланс сейчас дополнительно учитывает текущий незакрытый результат/);
});


test("strategy summary capital formatting always uses two decimals and 1000 base", () => {
  assert.match(dashboardJs, /const STRATEGY_START_CAPITAL=1000/);
  assert.match(dashboardJs, /function fmtStrategyCapital\(value\)/);
  assert.match(dashboardJs, /minimumFractionDigits:2,maximumFractionDigits:2/);
  assert.match(dashboardJs, /STRATEGY_START_CAPITAL\*\(1\+number\/100\)/);
  assert.match(dashboardJs, /fmtStrategyCapital\(capitalAfterClosed\)/);
  assert.match(dashboardJs, /fmtStrategyCapital\(capitalNow\)/);
  assert.doesNotMatch(dashboardJs, /fmtMoneyFrom100/);
  assert.doesNotMatch(dashboardJs, /Из \$100/);
  assert.doesNotMatch(dashboardJs, /100 \+ closedResultPct/);
  assert.equal(`$${(1000*(1+0.0001/100)).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2})}`, "$1 000,00");
});

test("strategy summary filtering sorting and refresh hooks are wired", () => {
  assert.match(dashboardJs, /let strategySummaryRows=\[\]/);
  assert.match(dashboardJs, /function filteredStrategySummary\(\)/);
  assert.match(dashboardJs, /function sortStrategySummary\(rows\)/);
  assert.match(dashboardJs, /Number\(row\.entryMode\)!==Number\(entryMode\)/);
  assert.match(dashboardJs, /Number\(row\.totalTrades\|\|0\)<minTrades/);
  assert.match(dashboardJs, /totalFullCapitalResultPct/);
  assert.match(dashboardJs, /await loadStrategySummary\(\)/);
  assert.match(dashboardJs, /strategySummarySearch","strategySummaryTimeframe","strategySummaryEntryMode","strategySummaryMinTrades","strategySummarySort/);
});

test("strategy summary scrolls and avoids negative zero display", () => {
  assert.match(appCss, /\.strategy-summary-table-wrap\{max-height:620px;overflow:auto;border:1px solid var\(--line\);border-radius:16px/);
  assert.match(appCss, /\.strategy-summary-table thead th\{position:sticky;top:0;z-index:2/);
  assert.match(appCss, /min-width:1320px/);
  assert.match(dashboardJs, /function normalizeDisplayZero\(value\)/);
  assert.match(dashboardJs, /Math\.abs\(number\)<0\.00005\?0:number/);
});

test("strategy dashboard shows long active trade diagnostics and summary labels", () => {
  assert.match(strategyHtml, /Доп\. страниц свечей/);
  assert.match(strategyHtml, /Сделок без полной истории/);
  assert.match(dashboardJs, /strategyLongTradePages/);
  assert.match(dashboardJs, /strategyUncoveredActiveTrades/);
  assert.match(dashboardJs, /Завершено тейком/);
  assert.match(dashboardJs, /Средний результат позиции/);
  assert.match(dashboardJs, /Расчёт ведётся от начального виртуального капитала \$1 000/);
});
