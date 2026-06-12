import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_PROFILES, PROJECT_CATEGORIES, PROJECTS, getProjectProfile, getRegisteredProject, normalizeProjectInput } from "../src/config/projects.js";
import { buildRuntimeProjectSkeleton, inferProjectCategory, resolveProject } from "../src/lib/project-resolution.js";

const noDiscoveryCalls = new Proxy({}, {
  get() { return () => { throw new Error("project resolution must not perform runtime discovery"); }; },
});

test("normalization produces stable lowercase slugs", () => {
  assert.equal(normalizeProjectInput("  ETH  "), "eth");
  assert.equal(normalizeProjectInput("Example Token"), "example-token");
  assert.equal(normalizeProjectInput("example_token"), "example-token");
  assert.equal(normalizeProjectInput(null), "");
});

test("registered lookup supports slug, ticker, name, CoinGecko id, and aliases", () => {
  for (const input of ["eth", "ETH", "Ethereum", "ether"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.eth);
  }
  for (const input of ["sol", "SOL", "Solana"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.sol);
  }
});

test("resolver gives curated projects priority without runtime discovery", async () => {
  for (const [input, expected] of [["eth", PROJECTS.eth], ["ETH", PROJECTS.eth], ["ethereum", PROJECTS.eth], ["sol", PROJECTS.sol], ["solana", PROJECTS.sol]]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.slug, expected.slug);
    assert.equal(project.ticker, expected.ticker);
    assert.equal(project.resolution.mode, "registered");
    assert.equal(project.resolution.source, "curated");
    assert.deepEqual(project.resolution.normalized, { slug:expected.slug, ticker:expected.ticker });
  }
});

test("resolver returns a conservative profiled fallback when discovery is unavailable", async () => {
  for (const input of ["doge", "pepe", "link"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    const slug = input.toLowerCase();
    const ticker = input.toUpperCase();

    assert.equal(project.slug, slug);
    assert.equal(project.ticker, ticker);
    const expectedCategory = input === "link" ? PROJECT_CATEGORIES.UTILITY : PROJECT_CATEGORIES.MEME;
    const expectedProfile = input === "link" ? ANALYSIS_PROFILES.UTILITY_TOKEN : ANALYSIS_PROFILES.MEME_ASSET;
    assert.equal(project.projectType, "runtime");
    assert.equal(project.category, expectedCategory);
    assert.equal(project.analysisProfile, expectedProfile);
    assert.equal(project.capabilities.hasNarrativeNews, true);
    assert.equal(project.capabilities.hasNarrativeMomentum, expectedCategory === PROJECT_CATEGORIES.MEME);
    assert.equal(project.capabilities.hasTvl, false);
    assert.ok(project.preferredSections.includes("narrative_and_news"));
    assert.deepEqual(project.categories, []);
    assert.equal(project.newsRelevance.mode, "strict");
    assert.ok(project.branding.iconKey);
    assert.deepEqual(project.resolution, {
      mode: "runtime",
      source: "fallback",
      input,
      normalized: { slug, ticker },
      signals: { isMeme:expectedCategory === PROJECT_CATEGORIES.MEME },
    });
  }
});

test("runtime skeleton normalizes mixed-case and name-shaped input", () => {
  const project = buildRuntimeProjectSkeleton("  Example Token  ");
  assert.equal(project.slug, "example-token");
  assert.equal(project.ticker, "EXAMPLE-TOKEN");
  assert.equal(project.resolution.input, "Example Token");
  assert.deepEqual(project.resolution.normalized, { slug:"example-token", ticker:"EXAMPLE-TOKEN" });
});

test("empty project input does not produce a fallback", async () => {
  assert.equal(await resolveProject("   "), null);
  assert.equal(buildRuntimeProjectSkeleton(null), null);
});

function discoveryFor(coin, coinDetails, { chains = [], stablecoins = [], protocols = [] } = {}) {
  return {
    searchCoinGeckoProjects: async () => [coin],
    fetchCoinGeckoProject: async () => coinDetails,
    fetchDefiLlamaChains: async () => chains,
    fetchStablecoinChains: async () => stablecoins,
    fetchDefiLlamaProtocols: async () => protocols,
  };
}

test("runtime discovery infers cautious profiles for doge, pepe, and link", async () => {
  const doge = await resolveProject("doge", discoveryFor(
    { id:"dogecoin", symbol:"doge", name:"Dogecoin", market_cap_rank:9 },
    { categories:["Meme", "Dog-Themed Coins", "Solana Ecosystem"], image:{ large:"https://assets.test/doge.png" }, market_data:{ circulating_supply:150_000_000_000, total_volume:{ usd:1_000_000 } } },
    { chains:[{ name:"Dogecoin", tokenSymbol:"DOGE", tvl:25_000 }] },
  ));
  const pepe = await resolveProject("pepe", discoveryFor(
    { id:"pepe", symbol:"pepe", name:"Pepe", market_cap_rank:30 },
    { categories:["Meme", "Frog-Themed Coins"], market_data:{ total_supply:420_690_000_000_000, total_volume:{ usd:500_000 } } },
  ));
  const link = await resolveProject("link", discoveryFor(
    { id:"chainlink", symbol:"link", name:"Chainlink", market_cap_rank:15 },
    { categories:["Oracle", "Interoperability"], market_data:{ circulating_supply:650_000_000, total_volume:{ usd:750_000 } } },
    { protocols:[{ name:"Chainlink", slug:"chainlink", category:"Oracle", tvl:10_000_000 }] },
  ));

  assert.equal(doge.category, PROJECT_CATEGORIES.MEME);
  assert.equal(doge.analysisProfile, ANALYSIS_PROFILES.MEME_ASSET);
  assert.equal(doge.capabilities.hasNarrativeMomentum, true);
  assert.deepEqual(doge.categories, ["Meme", "Dog-Themed Coins"]);
  assert.equal(doge.newsRelevance.mode, "strict");
  assert.equal(doge.branding.iconKey, "dogecoin");
  assert.equal(doge.branding.iconUrl, "https://assets.test/doge.png");
  assert.equal(pepe.category, PROJECT_CATEGORIES.MEME);
  assert.equal(pepe.capabilities.hasTvl, false);
  assert.equal(link.category, PROJECT_CATEGORIES.UTILITY);
  assert.equal(link.analysisProfile, ANALYSIS_PROFILES.UTILITY_TOKEN);
  assert.equal(link.capabilities.hasTokenUtilityData, true);
  assert.equal(link.capabilities.hasTvl, true);
  assert.equal(link.resolution.source, "discovery");
  assert.ok(link.preferredSections.includes("liquidity_and_trading"));
  assert.ok(link.preferredSections.includes("valuation"));
});

test("category inference favors utility over weak protocol or market-only signals", () => {
  assert.equal(inferProjectCategory({ hasProtocolData:true, hasTvl:true }), PROJECT_CATEGORIES.UTILITY);
  assert.equal(inferProjectCategory({ hasProtocolData:true, hasProtocolFees:true }), PROJECT_CATEGORIES.DEFI);
  assert.equal(inferProjectCategory({ isConsumer:true }), PROJECT_CATEGORIES.CONSUMER);
  assert.equal(inferProjectCategory({ hasChainData:true }), PROJECT_CATEGORIES.INFRA);
  assert.equal(inferProjectCategory({ isMeme:true, hasChainData:true }), PROJECT_CATEGORIES.MEME);
});

test("runtime inference does not replace curated project profiles", async () => {
  for (const input of ["eth", "sol"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.resolution.mode, "registered");
    assert.deepEqual(getProjectProfile(project), getProjectProfile(PROJECTS[input]));
  }
});
