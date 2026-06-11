import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PROJECTS } from "../src/config/projects.js";
import { applySectionSelection } from "../src/lib/section-selection.js";

async function loadReport(slug) {
  return JSON.parse(await readFile(new URL(`../public/data/reports/${slug}.json`, import.meta.url), "utf8"));
}

test("ETH reference report keeps its current key sections selected", async () => {
  const report = await loadReport("eth");
  const selection = applySectionSelection(report, PROJECTS.eth);

  for (const section of ["tokenomics", "financials", "tvl_and_capital", "users_and_activity", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]) {
    assert.ok(["enabled", "partial"].includes(selection.sections[section].status), `${section} should remain renderable`);
  }
});

test("SOL report demonstrates capability-driven users section selection", async () => {
  const report = await loadReport("sol");
  const selection = applySectionSelection(report, PROJECTS.sol);

  assert.equal(selection.sections.users_and_activity.status, "disabled_by_missing_data");
  assert.ok(["enabled", "partial"].includes(selection.sections.tvl_and_capital.status));
  assert.ok(["enabled", "partial"].includes(selection.sections.financials.status));
});
