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


const metric = (value = 1) => ({ value, formatted:String(value), status:"live", source:"test" });
const unavailableMetric = () => ({ value:null, formatted:"—", status:"unavailable", source:"test" });

function runtimeProject(category, capabilities, preferredSections) {
  return {
    resolution:{ mode:"runtime" },
    projectProfile:{ category, capabilities, preferredSections },
  };
}

function runtimeReport() {
  return {
    meta:{ project_resolution:{ mode:"runtime" } },
    market:{ price:metric(), market_cap:metric(), volume_24h:metric() },
    tokenomics:{ metrics:{ circulating_supply:metric() } },
    liquidity:{ metrics:{ spot_volume:metric() } },
    valuation:{ metrics:{ volume_market_cap:metric() } },
    capital:{ metrics:{ tvl:unavailableMetric(), stablecoins_mcap:unavailableMetric() } },
    financials:{ metrics:{ chain_fees_24h:unavailableMetric(), dex_volume_24h:unavailableMetric(), volume_market_cap:metric() } },
    users:{ metrics:{ daily_active_addresses:unavailableMetric() } },
    narrative:{ items:["Narrative"] },
    risks:{ items:["Risk"] },
    final_verdict:{ paragraphs:["Summary"] },
  };
}

test("runtime meme selection keeps a minimal relevant set and rejects ETH-like sections", () => {
  const preferred = ["market", "tokenomics", "tvl_and_capital", "financials", "users_and_activity", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"];
  const project = runtimeProject("meme", { hasTokenomics:true, hasTvl:true, hasChainFees:true, hasUsersData:true, hasLiquidityData:true, hasNarrativeNews:true }, preferred);
  const selection = applySectionSelection(runtimeReport(), project);

  assert.deepEqual(selection.enabledSections, ["market", "tokenomics", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]);
  for (const section of ["tvl_and_capital", "financials", "users_and_activity", "valuation"]) {
    assert.equal(selection.sections[section].status, "disabled_by_profile");
  }
});

test("runtime utility selection includes valuation but hides empty capital and financial blocks", () => {
  const preferred = ["market", "tokenomics", "tvl_and_capital", "financials", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"];
  const project = runtimeProject("utility", { hasTokenomics:true, hasTvl:true, hasChainFees:true, hasLiquidityData:true, hasNarrativeNews:true }, preferred);
  const selection = applySectionSelection(runtimeReport(), project);

  assert.deepEqual(selection.enabledSections, ["market", "tokenomics", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"]);
  assert.equal(selection.sections.tvl_and_capital.status, "disabled_by_profile");
  assert.equal(selection.sections.financials.status, "disabled_by_missing_data");
});

test("runtime infra selection only exposes capability-backed sections with real data", () => {
  const preferred = ["market", "tokenomics", "tvl_and_capital", "financials", "users_and_activity", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"];
  const project = runtimeProject("infra", { hasTokenomics:true, hasTvl:true, hasChainFees:true, hasUsersData:true, hasLiquidityData:true, hasNarrativeNews:true }, preferred);
  const selection = applySectionSelection(runtimeReport(), project);

  assert.deepEqual(selection.enabledSections, ["market", "tokenomics", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]);
  for (const section of ["tvl_and_capital", "financials", "users_and_activity"]) {
    assert.equal(selection.sections[section].status, "disabled_by_missing_data");
  }
});

test("runtime utility selection rejects protocol TVL even when a discovery match supplies it", () => {
  const report = runtimeReport();
  report.capital.metrics.tvl = metric(10_000_000);
  const preferred = ["market", "tokenomics", "tvl_and_capital", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"];
  const project = runtimeProject("utility", { hasTokenomics:true, hasTvl:true, hasLiquidityData:true, hasNarrativeNews:true }, preferred);
  const selection = applySectionSelection(report, project);

  assert.equal(selection.sections.tvl_and_capital.status, "disabled_by_profile");
  assert.ok(!selection.enabledSections.includes("tvl_and_capital"));
});


test("BTC reference report selects macro sections and rejects ETH-like blocks", async () => {
  const report = await loadReport("btc");
  const selection = applySectionSelection(report, PROJECTS.btc);

  for (const section of ["market", "tokenomics", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"]) {
    assert.ok(["enabled", "partial"].includes(selection.sections[section].status), `${section} should remain renderable`);
  }
  for (const section of ["tvl_and_capital", "stablecoins", "financials", "users_and_activity"]) assert.equal(selection.sections[section].status, "disabled_by_profile");
});

test("BNB reference report keeps hybrid economy and capital sections renderable", async () => {
  const report = await loadReport("bnb");
  const selection = applySectionSelection(report, PROJECTS.bnb);

  for (const section of ["market", "tokenomics", "financials", "tvl_and_capital", "stablecoins", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]) {
    assert.ok(["enabled", "partial"].includes(selection.sections[section].status), `${section} should remain renderable`);
  }
  assert.equal(report.tokenomics.metrics.burn_mechanism.formatted, "Auto-Burn + BEP-95");
  assert.equal(report.semantic_metrics.exchange_utility.formatted, "Binance ecosystem utility");
});

test("LINK curated selection enables utility adoption and rejects ETH-like capital blocks", async () => {
  const report = await loadReport("link");
  const selection = applySectionSelection(report, PROJECTS.link);

  for (const section of ["market", "tokenomics", "liquidity_and_trading", "valuation", "utility_and_adoption", "narrative_and_news", "risks", "final_summary"]) {
    assert.ok(["enabled", "partial"].includes(selection.sections[section].status), `${section} should remain renderable`);
  }
  for (const section of ["tvl_and_capital", "stablecoins", "rwa", "financials", "users_and_activity", "demand_and_flows"]) {
    assert.equal(selection.sections[section].status, "disabled_by_profile");
  }
});
