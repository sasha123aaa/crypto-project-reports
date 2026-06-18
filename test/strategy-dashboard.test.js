import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dashboardJs = await readFile(new URL("../public/assets/strategy-dashboard.js", import.meta.url), "utf8");
const siteNavJs = await readFile(new URL("../public/assets/site-nav.js", import.meta.url), "utf8");
const homeHtml = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

test("strategy-dashboard.js contains calls to strategy APIs", () => {
  assert.match(dashboardJs, /\/api\/strategy\/status/);
  assert.match(dashboardJs, /\/api\/strategy\/run-monitor\?key=/);
  assert.match(dashboardJs, /\/api\/strategy\/active/);
  assert.match(dashboardJs, /\/api\/strategy\/trades\?limit=50/);
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
  assert.match(dashboardJs, /\/api\/strategy\/rebuild-stats\?key=/);
});

test("strategy backfill UI uses safe loop controls", () => {
  assert.match(dashboardJs, /let backfillLoopActive=false/);
  assert.match(dashboardJs, /let backfillLoopAbort=false/);
  assert.match(dashboardJs, /limit:"1"/);
  assert.match(dashboardJs, /maxRuntimeMs:"18000"/);
  assert.match(dashboardJs, /Number\(payload\.offset\|\|0\)===0&&Number\(payload\.totalJobs\|\|0\)>0/);
  assert.match(dashboardJs, /Cloudflare остановил слишком большую пачку/);
  assert.match(strategyHtml, /strategyBackfillStopBtn/);
  assert.match(strategyHtml, /Остановить/);
});
