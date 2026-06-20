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
