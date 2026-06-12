import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS, getProjectProfile } from "../src/config/projects.js";
import { buildReport } from "../src/lib/build-report.js";
import { buildRuntimeProjectConfig, resolveProject } from "../src/lib/project-resolution.js";

const unavailableDiscovery = {
  searchCoinGeckoProjects: async () => { throw new Error("discovery unavailable"); },
};

async function withUnavailableSources(run) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (input) => {
    requests.push(String(input));
    throw new Error("source unavailable");
  };
  try {
    return await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("runtime fallback project builds a compatible partial report without curated-only identifiers", async () => {
  const project = await resolveProject("example-token", unavailableDiscovery);

  await withUnavailableSources(async (requests) => {
    const report = await buildReport(project);

    assert.equal(report.meta.slug, project.slug);
    assert.equal(report.meta.project_resolution.mode, "runtime");
    assert.deepEqual(report.meta.project_profile, getProjectProfile(project));
    assert.ok(report.meta.section_selection.enabledSections.includes("market"));
    assert.equal(report.meta.section_selection.sections.tvl_and_capital.status, "disabled_by_profile");
    assert.equal(report.meta.section_selection.sections.financials.status, "disabled_by_profile");
    assert.equal(report.meta.section_selection.sections.users_and_activity.status, "disabled_by_profile");
    assert.ok(!report.meta.section_selection.enabledSections.includes("tvl_and_capital"));
    assert.ok(!report.meta.section_selection.enabledSections.includes("financials"));
    assert.ok(!report.meta.section_selection.enabledSections.includes("users_and_activity"));
    assert.equal(report.market.price.status, "unavailable");
    assert.deepEqual(report.charts.price_history, []);
    assert.ok(!requests.some((url) => url.includes("api.coingecko.com")), "CoinGecko must not be called without a resolved id");
    assert.ok(!requests.some((url) => url.includes("undefined")), "missing curated identifiers must not produce malformed source requests");
  });
});

test("buildReport keeps curated ETH and SOL profiles and selected sections compatible", async () => {
  await withUnavailableSources(async () => {
    for (const project of [PROJECTS.eth, PROJECTS.sol]) {
      const report = await buildReport(project);

      assert.equal(report.meta.slug, project.slug);
      assert.deepEqual(report.meta.project_profile, getProjectProfile(project));
      assert.ok(report.meta.section_selection.enabledSections.includes("market"));
      assert.ok(report.meta.section_selection.enabledSections.includes("tvl_and_capital"));
      assert.ok(report.meta.section_selection.enabledSections.includes("financials"));
      assert.equal(report.meta.market_symbols.tradingView, `BYBIT:${project.ticker}USDT`);
      assert.equal(report.meta.market_symbols.technical, `${project.ticker}USDT`);
      assert.ok(report.executive_summary.items.length <= 3);
      assert.deepEqual(report.meta.section_order.slice(-3), ["summary", "final_verdict", "narrative_and_news"]);
    }
  });
});

function runtimeDiscoveryCase({ id, symbol, name, categories, market, chain = null, protocol = null }) {
  return buildRuntimeProjectConfig(symbol, {
    coin:{ id, symbol, name, market_cap_rank:20 },
    coinDetails:{ categories, market_data:{ circulating_supply:market.circulating_supply, total_supply:market.total_supply, max_supply:market.max_supply, total_volume:{ usd:market.total_volume } } },
    chain,
    protocol,
  });
}

async function withRuntimeMarketSources(markets, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/coins/markets")) {
      const id = url.searchParams.get("ids");
      return new Response(JSON.stringify([markets[id]]), { status:200, headers:{ "content-type":"application/json" } });
    }
    if (url.pathname.includes("/market_chart")) {
      return new Response(JSON.stringify({
        prices:[[1_700_000_000_000, 1], [1_700_086_400_000, 1.1]],
        total_volumes:[[1_700_000_000_000, 10], [1_700_086_400_000, 12]],
        market_caps:[[1_700_000_000_000, 100], [1_700_086_400_000, 110]],
      }), { status:200, headers:{ "content-type":"application/json" } });
    }
    return new Response("unavailable", { status:503 });
  };
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("DOGE, PEPE, and LINK runtime reports keep category-safe sections and summaries", async () => {
  const marketRows = {
    dogecoin:{ current_price:0.15, market_cap:22_000_000_000, fully_diluted_valuation:22_000_000_000, total_volume:1_100_000_000, circulating_supply:150_000_000_000, total_supply:150_000_000_000, max_supply:null },
    pepe:{ current_price:0.00001, market_cap:4_200_000_000, fully_diluted_valuation:4_200_000_000, total_volume:800_000_000, circulating_supply:420_690_000_000_000, total_supply:420_690_000_000_000, max_supply:420_690_000_000_000 },
    chainlink:{ current_price:15, market_cap:10_000_000_000, fully_diluted_valuation:15_000_000_000, total_volume:500_000_000, circulating_supply:650_000_000, total_supply:1_000_000_000, max_supply:1_000_000_000 },
  };
  const projects = [
    runtimeDiscoveryCase({ id:"dogecoin", symbol:"doge", name:"Dogecoin", categories:["Meme", "Dog-Themed Coins"], market:marketRows.dogecoin, chain:{ name:"Dogecoin", tvl:25_000 } }),
    runtimeDiscoveryCase({ id:"pepe", symbol:"pepe", name:"Pepe", categories:["Meme", "Frog-Themed Coins"], market:marketRows.pepe }),
    runtimeDiscoveryCase({ id:"chainlink", symbol:"link", name:"Chainlink", categories:["Oracle", "Interoperability"], market:marketRows.chainlink, protocol:{ name:"Chainlink", slug:"chainlink", category:"Oracle", tvl:10_000_000 } }),
  ];

  await withRuntimeMarketSources(marketRows, async () => {
    const [doge, pepe, link] = await Promise.all(projects.map(buildReport));

    for (const report of [doge, pepe]) {
      assert.equal(report.meta.project_profile.category, "meme");
      assert.deepEqual(new Set(report.meta.section_selection.enabledSections), new Set(["market", "tokenomics", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]));
      assert.equal(report.meta.section_selection.sections.tvl_and_capital.status, "disabled_by_profile");
      assert.equal(report.meta.section_selection.sections.financials.status, "disabled_by_profile");
      assert.doesNotMatch(report.executive_summary.items.join(" "), /TVL|инфраструктур|сетевая экономика/i);
      assert.ok(report.executive_summary.items.length <= 3);
      assert.equal(report.meta.market_symbols.tradingView, `BYBIT:${report.meta.ticker}USDT`);
      assert.deepEqual(report.meta.section_order, ["tokenomics", "summary", "final_verdict", "narrative_and_news"]);
      assert.equal(report.meta.market_symbols.technical, `${report.meta.ticker}USDT`);
      assert.match(report.final_verdict.subtitle, /ликвидность|импульс/i);
      assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "trading_quality"]);
      assert.equal(report.market.price.formatted, report.meta.ticker === "PEPE" ? "$0.00001" : "$0.15");
      assert.deepEqual(report.metric_slots.market, []);
      assert.deepEqual(report.metric_slots.tokenomics.map(({ key }) => key), report.meta.ticker === "PEPE"
        ? ["fdv", "circulating_supply", "total_supply", "max_supply"]
        : ["fdv", "circulating_supply", "total_supply"]);
      const repeatedKeys = Object.values(report.metric_slots).flat().filter((item) => report.hero.kpis.some((heroItem) => heroItem.key === item.key));
      assert.deepEqual(repeatedKeys, []);
      assert.deepEqual(report.chart_slots.map(({ key }) => key), ["price_history", "volume_history", "market_cap_history"]);
    }

    assert.equal(link.meta.project_profile.category, "utility");
    assert.deepEqual(new Set(link.meta.section_selection.enabledSections), new Set(["market", "tokenomics", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"]));
    assert.equal(link.meta.section_selection.sections.tvl_and_capital.status, "disabled_by_profile");
    assert.doesNotMatch(link.executive_summary.items.join(" "), /блокчейн-платформ|TVL|сетевая экономика/i);
    assert.ok(link.executive_summary.items.length <= 3);
    assert.equal(link.meta.market_symbols.tradingView, "BYBIT:LINKUSDT");
    assert.match(link.final_verdict.subtitle, /спрос на токен/i);
    assert.match(link.valuation.text.join(" "), /utility-токена/i);
    assert.equal(link.valuation.metrics.valuation_status.status, "unavailable");
    assert.deepEqual(link.hero.kpis.map(({ key }) => key), ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply"]);
    assert.deepEqual(link.chart_slots.map(({ key }) => key), ["price_history", "volume_history", "market_cap_history"]);
  });
});

test("buildReport keeps MNT and NEAR on the shared ecosystem-growth template", async () => {
  await withUnavailableSources(async () => {
    const [mnt, near] = await Promise.all([buildReport(PROJECTS.mnt), buildReport(PROJECTS.near)]);
    for (const report of [mnt, near]) {
      assert.equal(report.meta.project_profile.category, "ecosystem_growth");
      assert.equal(report.meta.project_profile.analysisProfile, "infra_ecosystem_growth");
      assert.ok(report.meta.section_selection.enabledSections.includes("tvl_and_capital"));
      assert.ok(report.meta.section_selection.enabledSections.includes("financials"));
      assert.deepEqual(report.meta.section_order.slice(-3), ["summary", "final_verdict", "narrative_and_news"]);
    }
    assert.equal(mnt.meta.market_symbols.tradingView, "BYBIT:MNTUSDT");
    assert.equal(near.meta.market_symbols.tradingView, "BINANCE:NEARUSDT");
    assert.doesNotMatch(mnt.final_verdict.paragraphs.join(" "), /AI/i);
    assert.match(near.final_verdict.paragraphs.join(" "), /нарратив|usage/i);
  });
});
