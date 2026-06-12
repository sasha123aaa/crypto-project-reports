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


test("BTC macro semantics prioritize market structure and supply without infra metrics", () => {
  const report = baseReport();
  report.tokenomics = { metrics:{ circulating_supply:metric(), total_supply:metric(), max_supply:metric() } };
  report.charts = { price_history:[[1, 1], [2, 2]], volume_history:[[1, 1], [2, 2]], market_cap_history:[[1, 1], [2, 2]], tvl_history:[[1, 1], [2, 2]], stablecoins_history:[[1, 1], [2, 2]] };
  applyProfileAwareSemantics(report, PROJECTS.btc);

  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply"]);
  assert.deepEqual(report.chart_slots.map(({ key }) => key), ["price_history", "volume_history", "market_cap_history"]);
  assert.deepEqual(report.meta.section_order, ["tokenomics", "demand_and_flows", "summary", "final_verdict", "narrative_and_news"]);
  assert.match(report.hero.lead, /рыночную роль/i);
  assert.match(report.final_verdict.paragraphs.join(" "), /макро-активом/i);
  assert.doesNotMatch(JSON.stringify(report.executive_summary), /TVL|DeFi|блокспейс/i);
});


test("BNB hybrid semantics prioritize burn and chain capital without becoming ETH-like", () => {
  const report = baseReport();
  report.tokenomics = { metrics:{
    burn_mechanism:{ value:null, formatted:"Auto-Burn + BEP-95", status:"static", source:"test" },
    circulating_supply:metric(), total_supply:metric(), max_supply:metric(),
  } };
  report.semantic_metrics.exchange_utility = { value:null, formatted:"Binance ecosystem utility", status:"static", source:"test" };
  report.valuation = { metrics:{ market_cap_tvl:metric(), stablecoins_tvl:metric(), annualized_chain_fees_market_cap:metric() } };
  report.charts = { price_history:[[1, 1], [2, 2]], volume_history:[[1, 1], [2, 2]], market_cap_history:[[1, 1], [2, 2]], chain_fees_history:[[1, 1], [2, 2]], tvl_history:[[1, 1], [2, 2]] };
  applyProfileAwareSemantics(report, PROJECTS.bnb);

  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "burn_mechanism", "exchange_utility", "tvl"]);
  assert.deepEqual(report.meta.section_order, ["tokenomics", "financials", "tvl_and_capital", "summary", "final_verdict", "narrative_and_news"]);
  assert.match(report.hero.lead, /Binance|BNB Chain|сокращение предложения/i);
  assert.match(report.tokenomics.conclusion, /Auto-Burn|gas fees|спросом/i);
  assert.match(report.tokenomics.text.join(" "), /circulating supply|current supply|100 млн|BEP-95|реальный спрос/i);
  assert.ok(report.metric_slots.financial.some(({ key }) => key === "annualized_chain_fees_market_cap"));
  assert.ok(report.metric_slots.capital.some(({ key }) => key === "stablecoins_tvl"));
  assert.match(report.final_verdict.paragraphs.join(" "), /hybrid-активом|Binance|BNB Chain/i);
  assert.doesNotMatch(report.hero.lead, /базов.*инфраструктур|независим.*денежн/i);
  assert.deepEqual(report.chart_slots.map(({ key }) => key), ["price_history", "chain_fees_history", "tvl_history", "volume_history"]);
});

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
  assert.ok([eth, sol, doge, pepe].every((report) => report.final_verdict.title === "Финальная оценка"));
  assert.ok([eth, sol, doge, pepe].every((report) => report.final_verdict.subtitle.startsWith("Инвестиционный тезис:")));
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

test("LINK oracle profile prioritizes utility and value capture without ETH-like capital semantics", () => {
  const report = baseReport();
  report.semantic_metrics = {};
  applyProfileAwareSemantics(report, PROJECTS.link);

  assert.equal(report.meta.project_profile.analysisProfile, "oracle_utility");
  assert.deepEqual(report.meta.section_order, ["tokenomics", "utility_and_adoption", "summary", "final_verdict", "narrative_and_news"]);
  assert.match(report.hero.lead, /oracle|данных|LINK/i);
  assert.match(report.final_verdict.paragraphs.join(" "), /value|спрос на LINK|захват/i);
  assert.ok(report.utility_adoption.items.length >= 3);
  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "token_utility", "adoption", "value_capture"]);
  assert.match(report.semantic_metrics.value_capture.formatted, /Непрямой|token demand/i);
  assert.match(report.tokenomics.text.join(" "), /dilution|total \/ max supply|value capture/i);
  assert.ok(!report.hero.kpis.some(({ key }) => ["tvl", "stablecoins", "fees"].includes(key)));
  assert.deepEqual(report.metric_slots.capital, []);
  assert.deepEqual(report.metric_slots.financial, []);
});

test("HYPE trading-economics semantics prioritize fees, volume, value capture, and valuation", () => {
  const report = baseReport();
  report.financials.metrics.app_fees_24h = metric();
  report.valuation = { metrics:{ annualized_app_fees_market_cap:metric(), dex_volume_market_cap:metric(), market_cap_tvl:metric() } };
  report.tokenomics = { metrics:{ circulating_supply:metric(), total_supply:metric(), max_supply:metric() } };
  report.charts = { price_history:[[1, 1], [2, 2]], app_fees_history:[[1, 1], [2, 2]], dex_history:[[1, 1], [2, 2]], volume_history:[[1, 1], [2, 2]], tvl_history:[[1, 1], [2, 2]] };
  applyProfileAwareSemantics(report, PROJECTS.hype);

  assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "fdv", "volume_24h", "protocol_fees", "dex_volume", "tvl", "value_capture"]);
  assert.equal(report.meta.semantic_profile, "trading_venue");
  assert.deepEqual(report.meta.section_order, ["tokenomics", "financials", "tvl_and_capital", "summary", "final_verdict", "narrative_and_news"]);
  assert.match(report.hero.lead, /торговый продукт|комиссии|value capture/i);
  assert.match(report.tokenomics.text.join(" "), /Assistance Fund|value capture|supply-риск/i);
  assert.ok(report.metric_slots.financial.some(({ key }) => key === "annualized_app_fees_market_cap"));
  assert.ok(report.metric_slots.financial.some(({ key }) => key === "dex_volume_market_cap"));
  assert.match(report.final_verdict.paragraphs.join(" "), /growth \/ revenue asset|value capture|объем/i);
  assert.doesNotMatch(report.hero.lead, /блокспейс|макро-актив|meme/i);
});

test("revenue-driven DeFi category template keeps common order and project-specific top KPIs", () => {
  const make = () => {
    const report = baseReport();
    report.capital = { metrics:{ tvl:metric() } };
    report.financials.metrics.app_fees_24h = metric();
    report.financials.metrics.dex_volume_24h = metric();
    report.tokenomics = { metrics:{ circulating_supply:metric(), total_supply:metric(), max_supply:metric(), net_issuance:metric() } };
    report.valuation = { metrics:{ market_cap_tvl:metric(), annualized_app_fees_market_cap:metric(), dex_volume_market_cap:metric() } };
    return report;
  };
  const pendle = make();
  const crv = make();
  applyProfileAwareSemantics(pendle, PROJECTS.pendle);
  applyProfileAwareSemantics(crv, PROJECTS.crv);

  assert.deepEqual(pendle.meta.section_order, crv.meta.section_order);
  assert.deepEqual(pendle.meta.section_order, ["tokenomics", "financials", "tvl_and_capital", "summary", "final_verdict", "narrative_and_news"]);
  assert.ok(pendle.hero.kpis.some(({ key }) => key === "token_utility"));
  assert.ok(!pendle.hero.kpis.some(({ key }) => key === "emission_pressure"));
  assert.ok(crv.hero.kpis.some(({ key }) => key === "emission_pressure"));
  assert.ok(crv.hero.kpis.some(({ key }) => key === "governance_role"));
  assert.match(pendle.final_verdict.paragraphs.join(" "), /PT \/ YT|product|usage/i);
  assert.match(crv.final_verdict.paragraphs.join(" "), /emissions|veCRV|liquidity/i);
});


test("MNT and NEAR use a shared ecosystem-growth template without identical investment logic", () => {
  const mnt = applyProfileAwareSemantics(baseReport(), PROJECTS.mnt);
  const near = applyProfileAwareSemantics(baseReport(), PROJECTS.near);
  assert.deepEqual(mnt.meta.section_order, ["tokenomics", "financials", "tvl_and_capital", "utility_and_adoption", "summary", "final_verdict", "narrative_and_news"]);
  assert.deepEqual(mnt.hero.kpis.map(({ key }) => key), ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "token_utility"]);
  assert.deepEqual(near.hero.kpis.map(({ key }) => key), ["price", "market_cap", "fdv", "volume_24h", "tvl", "fees", "adoption", "stablecoins"]);
  assert.match(mnt.final_verdict.paragraphs.join(" "), /value|захватывает|MNT/i);
  assert.match(near.final_verdict.paragraphs.join(" "), /нарратив|usage|NEAR/i);
  assert.doesNotMatch(mnt.final_verdict.paragraphs.join(" "), /AI/i);
  assert.ok(near.utility_adoption.items.some((item) => /AI-related|narrative/i.test(item)));
});
