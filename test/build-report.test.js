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
      return new Response(JSON.stringify({ prices:[[1_700_000_000_000, 1]] }), { status:200, headers:{ "content-type":"application/json" } });
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
      assert.match(report.final_verdict.subtitle, /Meme/);
      assert.deepEqual(report.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "trading_quality"]);
    }

    assert.equal(link.meta.project_profile.category, "utility");
    assert.deepEqual(new Set(link.meta.section_selection.enabledSections), new Set(["market", "tokenomics", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"]));
    assert.equal(link.meta.section_selection.sections.tvl_and_capital.status, "disabled_by_profile");
    assert.doesNotMatch(link.executive_summary.items.join(" "), /блокчейн-платформ|TVL|сетевая экономика/i);
    assert.match(link.final_verdict.subtitle, /Utility/);
    assert.match(link.valuation.text.join(" "), /utility-токена/i);
    assert.equal(link.valuation.metrics.valuation_status.status, "unavailable");
    assert.deepEqual(link.hero.kpis.map(({ key }) => key), ["price", "market_cap", "volume_24h", "fdv"]);
  });
});
