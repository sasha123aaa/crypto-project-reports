import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, PROJECT_PROFILE_EXAMPLES } from "../src/config/projects.js";
import { applyProfileAwareSemantics, selectHeroKpis } from "../src/lib/profile-semantics.js";

const metric = (value = 1) => ({ value, formatted:String(value), status:"live", source:"test" });
function baseReport() {
  return {
    meta:{}, hero:{}, market:{ price:metric(), market_cap:metric(), fdv:metric(), volume_24h:metric() },
    financials:{ metrics:{ chain_fees_24h:metric(), dex_volume_24h:metric(), volume_market_cap:metric() } },
    capital:{ metrics:{ tvl:metric(), stablecoins_mcap:metric() } }, users:{ metrics:{ daily_active_addresses:metric() } },
    semantic_metrics:{ liquidity:metric(), concentration:metric(), narrative_momentum:metric(), token_utility:metric(), adoption:metric() },
  };
}

test("infra hero KPI priorities preserve ETH-style capital metrics", () => {
  const keys = selectHeroKpis(baseReport(), PROJECTS.eth).map(({ key }) => key);
  assert.deepEqual(keys, ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins"]);
});


test("hero KPI selection promotes available category metrics over unavailable placeholders", () => {
  const report = baseReport();
  report.capital.metrics.tvl = { value:null, formatted:"—", status:"unavailable", source:"test" };
  const keys = selectHeroKpis(report, PROJECTS.eth).map(({ key }) => key);

  assert.deepEqual(keys, ["price", "market_cap", "fdv", "volume_24h", "stablecoins", "fees"]);
});

test("utility example selects utility and adoption metrics instead of infra capital metrics", () => {
  const project = PROJECT_PROFILE_EXAMPLES.utility;
  const report = applyProfileAwareSemantics(baseReport(), project);
  const keys = report.hero.kpis.map(({ key }) => key);

  assert.deepEqual(keys, ["price", "market_cap", "volume_24h", "token_utility", "liquidity", "adoption"]);
  assert.match(report.hero.lead, /роль токена/i);
  assert.match(report.final_verdict.subtitle, /Utility/i);
  assert.ok(report.profile.watch.some((item) => /product demand/i.test(item)));
});

test("meme semantics focus final verdict on unwind rather than network economics", () => {
  const project = { name:"Example Meme", ticker:"MEME", projectProfile:{ category:"meme", capabilities:{ hasLiquidityData:true, hasWhaleData:true, hasNarrativeMomentum:true } } };
  const report = applyProfileAwareSemantics(baseReport(), project);

  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "liquidity", "trading_quality", "concentration"]);
  assert.match(report.hero.status_text, /Meme-тезис/);
  assert.match(report.final_verdict.paragraphs.join(" "), /unwind/i);
  assert.doesNotMatch(report.executive_summary.items.join(" "), /L1|инфраструктур/i);
});

test("curated ETH copy is preserved while profile-aware KPIs and verdict are attached", () => {
  const report = baseReport();
  report.hero = { lead:"Curated ETH lead" };
  report.profile = { strengths:["Curated strength"] };
  applyProfileAwareSemantics(report, PROJECTS.eth, { preserveCurated:true });

  assert.equal(report.hero.lead, "Curated ETH lead");
  assert.deepEqual(report.profile.strengths, ["Curated strength"]);
  assert.equal(report.hero.kpis.length, 6);
  assert.match(report.final_verdict.subtitle, /Инфраструктура/);
});
