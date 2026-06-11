import test from "node:test";
import assert from "node:assert/strict";
import { PROJECTS } from "../src/config/projects.js";
import { buildRuntimeProjectConfig, inferProjectCategory, resolveProject } from "../src/lib/project-resolution.js";

const noDiscoveryCalls = new Proxy({}, {
  get() { return () => { throw new Error("curated project should resolve without discovery"); }; },
});

test("resolver gives curated projects priority across slug, ticker, and CoinGecko id", async () => {
  for (const input of ["eth", "ETH", "ethereum", "SOL", "solana"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    const expected = input.toLowerCase().includes("sol") ? PROJECTS.sol : PROJECTS.eth;
    assert.equal(project.slug, expected.slug);
    assert.equal(project.resolution.mode, "registered");
  }
});

test("category inference is cautious and signal-driven", () => {
  assert.equal(inferProjectCategory({ hasChainData:true }), "infra");
  assert.equal(inferProjectCategory({ isInfra:true }), "infra");
  assert.equal(inferProjectCategory({ hasProtocolData:true, hasTvl:true }), "defi");
  assert.equal(inferProjectCategory({ isDefi:true }), "defi");
  assert.equal(inferProjectCategory({ isMeme:true, hasProtocolData:true, hasTvl:true }), "meme");
  assert.equal(inferProjectCategory({}), "utility");
});

test("runtime resolver discovers an unregistered chain and builds a compatible profile", async () => {
  const discovery = {
    searchCoinGeckoProjects: async () => [{ id:"example-chain", symbol:"xch", name:"Example Chain", market_cap_rank:99 }],
    fetchCoinGeckoProject: async () => ({ categories:["Layer 1"], market_data:{ circulating_supply:1000, total_volume:{ usd:500 } } }),
    fetchDefiLlamaChains: async () => [{ name:"Example Chain", tokenSymbol:"XCH", tvl:123456 }],
    fetchStablecoinChains: async () => [{ name:"Example Chain", totalCirculatingUSD:{ peggedUSD:5000 } }],
    fetchDefiLlamaProtocols: async () => [],
  };

  const project = await resolveProject("XCH", discovery);
  assert.equal(project.resolution.mode, "runtime");
  assert.equal(project.coingeckoId, "example-chain");
  assert.equal(project.projectProfile.category, "infra");
  assert.equal(project.projectProfile.capabilities.hasTvl, true);
  assert.equal(project.projectProfile.capabilities.hasStablecoins, true);
  assert.ok(project.projectProfile.preferredSections.includes("tvl_and_capital"));
  assert.equal(project.runtimeData.tvl, 123456);
});

test("runtime fallback stays utility and light when only market identity is available", () => {
  const project = buildRuntimeProjectConfig("new", {
    coin:{ id:"new-token", symbol:"new", name:"New Token" },
    coinDetails:{ market_data:{ total_volume:{ usd:1000 } } },
  });

  assert.equal(project.projectProfile.category, "utility");
  assert.deepEqual(project.projectProfile.preferredSections, ["market", "narrative_and_news", "risks", "final_summary"]);
  assert.equal(project.projectProfile.capabilities.hasTvl, false);
  assert.equal(project.projectProfile.capabilities.hasProtocolFees, false);
});

test("meme categories produce a meme runtime profile without invented fundamentals", () => {
  const project = buildRuntimeProjectConfig("pepe", {
    coin:{ id:"pepe", symbol:"pepe", name:"Pepe" },
    coinDetails:{ categories:["Meme Token"], market_data:{ total_volume:{ usd:1000 }, circulating_supply:420 } },
  });

  assert.equal(project.projectProfile.category, "meme");
  assert.equal(project.projectProfile.capabilities.hasTvl, false);
  assert.ok(!project.projectProfile.preferredSections.includes("financials"));
});

test("runtime project can enter the existing report pipeline without enabling unsupported sections", async () => {
  const { buildReport } = await import("../src/lib/build-report.js");
  const project = buildRuntimeProjectConfig("new", {
    coin:{ id:"new-token", symbol:"new", name:"New Token" },
    coinDetails:{ market_data:{ circulating_supply:1000, total_volume:{ usd:2000 } } },
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (request) => {
    const url = String(request);
    if (url.includes("/coins/markets")) return new Response(JSON.stringify([{ current_price:2, market_cap:2000, total_volume:200, circulating_supply:1000 }]), { status:200 });
    if (url.includes("/market_chart")) return new Response(JSON.stringify({ prices:[[1, 2]] }), { status:200 });
    if (url.includes("api.bybit.com")) return new Response(JSON.stringify({ retCode:0, result:{ list:[] } }), { status:200 });
    return new Response("unavailable", { status:503 });
  };

  try {
    const report = await buildReport(project);
    assert.equal(report.meta.project_resolution.mode, "runtime");
    assert.equal(report.market.price.value, 2);
    assert.equal(report.meta.section_selection.sections.tvl_and_capital.status, "disabled_by_profile");
    assert.equal(report.meta.section_selection.sections.financials.status, "disabled_by_profile");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
