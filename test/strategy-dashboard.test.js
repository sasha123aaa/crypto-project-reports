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
