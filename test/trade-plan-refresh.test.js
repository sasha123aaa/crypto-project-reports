import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../public/assets/trade-plan.js", import.meta.url), "utf8");

test("manual refresh passes options instead of the click event", () => {
  assert.match(source, /refreshButton\.addEventListener\('click',event=>\{event\.preventDefault\(\);refreshTradePlan\(\{manual:true\}\)\}\)/);
});

test("chart refresh preserves the view and context failure is non-fatal", () => {
  const refreshSource = source.match(/async function refreshTradePlan[\s\S]*?(?=\n    document\.querySelectorAll)/)[0];

  assert.match(refreshSource, /await loadChart\(activeTf,\{preserveView:true\}\);status\.textContent='Обновлено только что'/);
  assert.match(refreshSource, /catch\(error\)\{console\.warn\('Market context refresh failed',error\)\}/);
  assert.match(refreshSource, /catch\(error\)\{console\.error\('Trade plan refresh failed',error\);status\.textContent='Ошибка обновления'\}/);
  assert.doesNotMatch(refreshSource, /Promise\.all/);
});
