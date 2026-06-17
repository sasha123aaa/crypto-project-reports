import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../public/assets/trade-plan.js", import.meta.url), "utf8");

test("manual refresh passes options instead of the click event", () => {
  assert.match(source, /refreshButton\.addEventListener\('click',event=>\{event\.preventDefault\(\);refreshTradePlan\(\{manual:true\}\)\}\)/);
});

test("chart refresh preserves the view and context failure is non-fatal", () => {
  const refreshSource = source.match(/async function refreshTradePlan[\s\S]*?(?=\n    document\.querySelectorAll)/)[0];

  assert.match(refreshSource, /const chartRefresh=await loadChart\(activeTf,\{preserveView:true\}\)/);
  assert.match(refreshSource, /status\.textContent=chartRefresh\.changed\?'Обновлено только что':'Свежих свечей пока нет'/);
  assert.match(refreshSource, /catch\(error\)\{console\.warn\('Market context refresh failed',error\)\}/);
  assert.match(refreshSource, /catch\(error\)\{console\.error\('Trade plan refresh failed',error\);status\.textContent='Ошибка обновления'\}/);
  assert.doesNotMatch(refreshSource, /Promise\.all/);
});

test("candle refresh bypasses caches and reports whether the latest candle changed", () => {
  const loadChartSource = source.match(/async function loadChart[\s\S]*?(?=\n    function updateTimer)/)[0];

  assert.match(loadChartSource, /new URLSearchParams\(\{timeframe:tf,_:String\(Date\.now\(\)\)\}\)/);
  assert.match(loadChartSource, /if\(initialExchangeParam\)candleParams\.set\("exchange",initialExchangeParam\)/);
  assert.match(loadChartSource, /const candlesUrl=`\/api\/trade-plan-candles\/\$\{encodeURIComponent\(slug\)\}\?\$\{candleParams\.toString\(\)\}`/);
  assert.match(loadChartSource, /fetchJsonWithTimeout\(/);
  assert.match(loadChartSource, /cache:\s*"no-store"/);
  assert.match(loadChartSource, /headers:\s*\{\s*"Cache-Control":\s*"no-cache"\s*\}/);
  assert.match(loadChartSource, /12000/);
  assert.match(loadChartSource, /const changed=!prevLastCandle\|\|!nextLastCandle\|\|/);
  assert.match(loadChartSource, /return \{changed,lastCandleTime:nextLastCandle\?\.time\|\|null\}/);
});
