import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, PROJECT_PROFILE_EXAMPLES } from "../src/config/projects.js";
import { applyProfileAwareSemantics, getCategorySectionOrder, isAvailableMetric, selectHeroKpis, selectReportMetricSlots } from "../src/lib/profile-semantics.js";

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

test("utility example prioritizes valuation and utility metrics instead of infra capital metrics", () => {
  const project = PROJECT_PROFILE_EXAMPLES.utility;
  const report = applyProfileAwareSemantics(baseReport(), project);
  const keys = report.hero.kpis.map(({ key }) => key);

  assert.deepEqual(keys, ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "token_utility"]);
  assert.match(report.hero.lead, /необходимость токена/i);
  assert.match(report.final_verdict.subtitle, /использование продукта/i);
  assert.ok(report.profile.watch.some((item) => /спросом на токен/i.test(item)));
});

test("meme semantics focus final verdict on unwind rather than network economics", () => {
  const project = { name:"Example Meme", ticker:"MEME", projectProfile:{ category:"meme", capabilities:{ hasLiquidityData:true, hasWhaleData:true, hasNarrativeMomentum:true } } };
  const report = applyProfileAwareSemantics(baseReport(), project);

  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "trading_quality", "liquidity", "concentration"]);
  assert.match(report.hero.status_text, /оборот к капитализации/i);
  assert.match(report.final_verdict.paragraphs.join(" "), /потеря внимания и ликвидности/i);
  assert.doesNotMatch(report.executive_summary.items.join(" "), /L1|инфраструктур/i);
});

test("meme tokenomics deepens the hero view without repeating its KPI keys", () => {
  const project = { name:"Example Meme", ticker:"MEME", projectProfile:{ category:"meme", capabilities:{ hasTokenomics:true, hasLiquidityData:true, hasWhaleData:true } } };
  const report = baseReport();
  report.tokenomics = { metrics:{ circulating_supply:metric(), total_supply:metric(), max_supply:metric() } };
  applyProfileAwareSemantics(report, project);

  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "trading_quality", "liquidity", "concentration"]);
  assert.deepEqual(report.metric_slots.market, []);
  assert.deepEqual(report.metric_slots.tokenomics.map(({ key }) => key), ["fdv", "circulating_supply", "total_supply", "max_supply"]);
  assert.deepEqual(report.metric_slots.tokenomics.map(({ key }) => key).filter((key) => report.hero.kpis.some((item) => item.key === key)), []);
});

test("curated ETH copy is preserved while profile-aware KPIs and verdict are attached", () => {
  const report = baseReport();
  report.hero = { lead:"Curated ETH lead" };
  report.profile = { strengths:["Curated strength"] };
  applyProfileAwareSemantics(report, PROJECTS.eth, { preserveCurated:true });

  assert.equal(report.hero.lead, "Curated ETH lead");
  assert.deepEqual(report.profile.strengths, ["Curated strength"]);
  assert.equal(report.hero.kpis.length, 6);
  assert.match(report.final_verdict.subtitle, /расчетный капитал/i);
});

test("runtime utility valuation avoids ETH-like TVL framing and fake maturity status", () => {
  const report = baseReport();
  report.valuation = {
    text:["Generic fundamental text"],
    metrics:{ valuation_status:{ value:null, formatted:"зрелый актив", status:"manual", source:"analyst" } },
  };

  applyProfileAwareSemantics(report, PROJECT_PROFILE_EXAMPLES.utility);

  assert.match(report.valuation.text.join(" "), /utility-токена/i);
  assert.match(report.valuation.text.join(" "), /Market Cap \/ TVL/);
  assert.equal(report.valuation.metrics.valuation_status.status, "unavailable");
  assert.equal(report.valuation.metrics.valuation_status.formatted, "—");
});

test("curated ETH valuation copy and status are preserved", () => {
  const report = baseReport();
  report.valuation = { text:["Curated valuation"], metrics:{ valuation_status:{ formatted:"curated", status:"manual" } } };

  applyProfileAwareSemantics(report, PROJECTS.eth, { preserveCurated:true });

  assert.deepEqual(report.valuation.text, ["Curated valuation"]);
  assert.equal(report.valuation.metrics.valuation_status.formatted, "curated");
});


test("metric availability rejects client-facing placeholders", () => {
  for (const formatted of ["—", "N/A", "unknown", "данные временно недоступны"]) {
    assert.equal(isAvailableMetric({ value:null, formatted, status:"partial" }), false);
  }
  assert.equal(isAvailableMetric({ value:null, formatted:"Есть", status:"manual" }), true);
});

test("profile-aware metric slots hide unavailable cards and fill capital with a stronger fallback", () => {
  const report = baseReport();
  report.tokenomics = { metrics:{
    market_cap:metric(), fdv:metric(), circulating_supply:metric(), total_supply:metric(),
    max_supply:{ value:null, formatted:"Нет", status:"static", source:"structure" },
  } };
  report.capital.metrics.rwa_active_mcap = { value:null, formatted:"N/A", status:"unavailable", source:"test" };
  report.valuation = { metrics:{ market_cap_tvl:metric(2), stablecoins_tvl:metric(0.5) } };

  const slots = selectReportMetricSlots(report, PROJECTS.eth);

  assert.deepEqual(slots.capital.map(({ key }) => key), ["stablecoins_tvl", "market_cap_tvl"]);
  assert.deepEqual(slots.capital.map(({ key }) => key).filter((key) => selectHeroKpis(report, PROJECTS.eth).some((item) => item.key === key)), []);
  assert.ok(!slots.tokenomics.some(({ key }) => key === "max_supply"));
  assert.ok(slots.tokenomics.every(({ metric }) => isAvailableMetric(metric)));
});

test("SOL slots omit unsupported RWA and DOGE slots avoid infra financial/capital metrics", () => {
  const solSlots = selectReportMetricSlots(baseReport(), PROJECTS.sol);
  assert.deepEqual(solSlots.capital, []);

  const doge = { name:"Dogecoin", ticker:"DOGE", projectProfile:{ category:"meme", capabilities:{ hasTokenomics:true, hasLiquidityData:true } } };
  const dogeReport = baseReport();
  dogeReport.tokenomics = { metrics:{ market_cap:metric(), fdv:metric(), circulating_supply:metric(), total_supply:metric(), max_supply:{ value:null, formatted:"—", status:"unavailable" } } };
  const dogeSlots = selectReportMetricSlots(dogeReport, doge);

  assert.deepEqual(dogeSlots.capital, []);
  assert.deepEqual(dogeSlots.financial, []);
  assert.ok(!dogeSlots.tokenomics.some(({ key }) => key === "max_supply"));
});

test("category chart packs only select available relevant series", async () => {
  const { selectChartSlots } = await import("../src/lib/profile-semantics.js");
  const charts = {
    price_history:[[1, 1], [2, 2]],
    volume_history:[[1, 10], [2, 20]],
    market_cap_history:[[1, 100], [2, 200]],
    tvl_history:[[1, 50], [2, 60]],
    chain_fees_history:[[1, 5], [2, 6]],
  };
  const meme = { projectProfile:{ category:"meme", capabilities:{ hasTokenomics:true, hasLiquidityData:true } } };
  const infra = { projectProfile:{ category:"infra", capabilities:{ hasTvl:true, hasChainFees:true } } };

  assert.deepEqual(selectChartSlots({ charts }, meme).map(({ key }) => key), ["price_history", "volume_history", "market_cap_history"]);
  assert.deepEqual(selectChartSlots({ charts }, infra).map(({ key }) => key), ["price_history", "chain_fees_history", "tvl_history"]);
});

test("project-specific copy separates ETH, SOL, DOGE, and PEPE investor framing", () => {
  const projects = [
    PROJECTS.eth,
    PROJECTS.sol,
    { slug:"doge", name:"Dogecoin", ticker:"DOGE", projectProfile:{ category:"meme", capabilities:{} } },
    { slug:"pepe", name:"Pepe", ticker:"PEPE", projectProfile:{ category:"meme", capabilities:{} } },
  ];
  const [eth, sol, doge, pepe] = projects.map((project) => applyProfileAwareSemantics(baseReport(), project));

  assert.match(eth.executive_summary.items.join(" "), /L1, L2|расчетный слой/i);
  assert.match(sol.executive_summary.items.join(" "), /быстро привлеченный капитал|устойчивые комиссии/i);
  assert.match(doge.executive_summary.items.join(" "), /узнаваемость DOGE|глубину выхода/i);
  assert.match(pepe.executive_summary.items.join(" "), /импульс|крупных продаж/i);
  assert.notDeepEqual(eth.executive_summary.items, sol.executive_summary.items);
  assert.notDeepEqual(doge.executive_summary.items, pepe.executive_summary.items);
  assert.ok([eth, sol, doge, pepe].every((report) => report.executive_summary.items.length >= 3 && report.executive_summary.items.length <= 4));
  assert.ok([eth, sol, doge, pepe].every((report) => report.final_verdict.paragraphs.length === 1));
  assert.ok([eth, sol, doge, pepe].every((report) => Object.values(report.profile).every((items) => items.length <= 2)));
});

test("category-aware semantics attach concise section conclusions", () => {
  const utility = applyProfileAwareSemantics({ ...baseReport(), tokenomics:{}, liquidity:{}, narrative:{} }, PROJECT_PROFILE_EXAMPLES.utility);
  const meme = applyProfileAwareSemantics({ ...baseReport(), tokenomics:{}, liquidity:{}, narrative:{} }, { name:"Meme", ticker:"MEME", projectProfile:{ category:"meme", capabilities:{} } });

  assert.match(utility.tokenomics.conclusion, /потребностью в токене/i);
  assert.match(utility.narrative.conclusion, /использование токена/i);
  assert.match(meme.liquidity.conclusion, /выйти из позиции|проскальзывания/i);
  assert.match(meme.narrative.conclusion, /внимания/i);
});


test("category-aware section order keeps summaries and verdicts before news", () => {
  const infraOrder = getCategorySectionOrder(PROJECTS.eth);
  const memeOrder = getCategorySectionOrder({ projectProfile:{ category:"meme", capabilities:{} } });

  assert.deepEqual(infraOrder.slice(0, 3), ["tokenomics", "financials", "tvl_and_capital"]);
  assert.deepEqual(memeOrder.slice(0, 1), ["tokenomics"]);
  for (const order of [infraOrder, memeOrder]) {
    assert.ok(order.indexOf("summary") < order.indexOf("final_verdict"));
    assert.ok(order.indexOf("final_verdict") < order.indexOf("narrative_and_news"));
  }
});

test("profile semantics publishes the category section order for the renderer", () => {
  const report = baseReport();
  applyProfileAwareSemantics(report, PROJECTS.sol);
  assert.deepEqual(report.meta.section_order, getCategorySectionOrder(PROJECTS.sol));
});
