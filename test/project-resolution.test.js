import assert from "node:assert/strict";
import test from "node:test";
import { ANALYSIS_PROFILES, PROJECT_CATEGORIES, PROJECTS, getProjectProfile, getRegisteredProject, normalizeProjectInput } from "../src/config/projects.js";
import { buildRuntimeProjectConfig, buildRuntimeProjectSkeleton, inferProjectCategory, resolveProject } from "../src/lib/project-resolution.js";
import { inferRuntimeLabels, normalizeRuntimeLabel } from "../src/lib/label-inference.js";
import { inferTitleSubtitle } from "../src/lib/title-subtitle-inference.js";
import { MARKET_EXCHANGE_PRIORITY, createMarketSymbols, marketTechnicalRoute, resolveExchangeMarketSymbols } from "../src/lib/market-symbols.js";

const noDiscoveryCalls = new Proxy({}, {
  get() { return () => { throw new Error("project resolution must not perform runtime discovery"); }; },
});

test("normalization produces stable lowercase slugs", () => {
  assert.equal(normalizeProjectInput("  ETH  "), "eth");
  assert.equal(normalizeProjectInput("Example Token"), "example-token");
  assert.equal(normalizeProjectInput("example_token"), "example-token");
  assert.equal(normalizeProjectInput("  NEAR.Protocol!  "), "near-protocol");
  assert.equal(normalizeProjectInput("$MNT"), "mnt");
  assert.equal(normalizeProjectInput(null), "");
});

test("registered lookup supports slug, ticker, name, CoinGecko id, and aliases", () => {
  for (const input of ["btc", "BTC", "Bitcoin", "xbt"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.btc);
  }
  for (const input of ["eth", "ETH", "Ethereum", "ether"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.eth);
  }
  for (const input of ["sol", "SOL", "Solana"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.sol);
  }
  for (const input of ["near", "near protocol", "near-protocol", "NEAR", "NEAR.Protocol!"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.near);
  }
  for (const input of ["mnt", "mantle", "MNT", "$MNT"]) {
    assert.equal(getRegisteredProject(input), PROJECTS.mnt);
  }
});

test("resolver gives curated projects priority without runtime discovery", async () => {
  for (const [input, expected] of [["btc", PROJECTS.btc], ["BTC", PROJECTS.btc], ["bitcoin", PROJECTS.btc], ["eth", PROJECTS.eth], ["ETH", PROJECTS.eth], ["ethereum", PROJECTS.eth], ["sol", PROJECTS.sol], ["solana", PROJECTS.sol], ["near", PROJECTS.near], ["near protocol", PROJECTS.near], ["mnt", PROJECTS.mnt], ["mantle", PROJECTS.mnt]]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.slug, expected.slug);
    assert.equal(project.ticker, expected.ticker);
    assert.equal(project.resolution.mode, "registered");
    assert.equal(project.resolution.source, "curated");
    assert.deepEqual(project.resolution.normalized, { slug:expected.slug, ticker:expected.ticker });
  }
});

test("ticker, slug, name, and alias resolution stays stable for supported projects", async () => {
  const cases = [
    ["btc", "btc", "curated"],
    ["eth", "eth", "curated"],
    ["bnb", "bnb", "curated"],
    ["sol", "sol", "curated"],
    ["doge", "doge", "fallback"],
    ["pepe", "pepe", "fallback"],
    ["hype", "hype", "curated"],
    ["link", "link", "curated"],
    ["near", "near", "curated"],
    ["near protocol", "near", "curated"],
    ["near-protocol", "near", "curated"],
    ["NEAR", "near", "curated"],
    ["mnt", "mnt", "curated"],
    ["mantle", "mnt", "curated"],
    ["MNT", "mnt", "curated"],
  ];

  for (const [input, slug, source] of cases) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.slug, slug, input);
    assert.equal(project.resolution.source, source, input);
  }
});

test("BTC curated identity keeps Bitcoin branding and exchange-aware symbol mapping", () => {
  assert.equal(PROJECTS.btc.branding.iconKey, "bitcoin");
  assert.equal(PROJECTS.btc.marketSymbols.base, "BTC");
  assert.equal(PROJECTS.btc.marketSymbols.tradingView, "BYBIT:BTCUSDT");
  assert.equal(PROJECTS.btc.bybitSymbol, "BTCUSDT");
  assert.deepEqual(marketTechnicalRoute(PROJECTS.btc.marketSymbols), { exchange:"BYBIT", symbol:"BTCUSDT", source:"Bybit spot" });
});


test("BNB curated identity uses Binance-first BNBUSDT mapping and aliases", async () => {
  for (const input of ["bnb", "BNB", "binancecoin", "binance coin"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.slug, PROJECTS.bnb.slug);
    assert.deepEqual(getProjectProfile(project), getProjectProfile(PROJECTS.bnb));
    assert.equal(project.resolution.mode, "registered");
  }
  assert.equal(PROJECTS.bnb.marketSymbols.base, "BNB");
  assert.equal(PROJECTS.bnb.marketSymbols.tradingView, "BINANCE:BNBUSDT");
  assert.equal(PROJECTS.bnb.marketSymbols.technical, "BNBUSDT");
  assert.equal(PROJECTS.bnb.branding.iconKey, "bnb");
  const resolved = await resolveExchangeMarketSymbols(PROJECTS.bnb.marketSymbols, async (route) => route.exchange === "BINANCE" && route.symbol === "BNBUSDT");
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.tradingView, "BINANCE:BNBUSDT");
  assert.deepEqual(marketTechnicalRoute(resolved), { exchange:"BINANCE", symbol:"BNBUSDT", source:"Binance spot" });
});

test("resolver returns a conservative profiled fallback when discovery is unavailable", async () => {
  for (const input of ["doge", "pepe"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    const slug = input.toLowerCase();
    const ticker = input.toUpperCase();

    assert.equal(project.slug, slug);
    assert.equal(project.ticker, ticker);
    const expectedCategory = PROJECT_CATEGORIES.MEME;
    const expectedProfile = ANALYSIS_PROFILES.MEME_ASSET;
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

test("runtime discovery infers cautious profiles for doge, pepe, and a generic oracle", async () => {
  const doge = await resolveProject("doge", discoveryFor(
    { id:"dogecoin", symbol:"doge", name:"Dogecoin", market_cap_rank:9 },
    { categories:["Meme", "Dog-Themed Coins", "Solana Ecosystem"], image:{ large:"https://assets.test/doge.png" }, market_data:{ circulating_supply:150_000_000_000, total_volume:{ usd:1_000_000 } } },
    { chains:[{ name:"Dogecoin", tokenSymbol:"DOGE", tvl:25_000 }] },
  ));
  const pepe = await resolveProject("pepe", discoveryFor(
    { id:"pepe", symbol:"pepe", name:"Pepe", market_cap_rank:30 },
    { categories:["Meme", "Frog-Themed Coins"], market_data:{ total_supply:420_690_000_000_000, total_volume:{ usd:500_000 } } },
  ));
  const link = buildRuntimeProjectConfig("oraclex", {
    coin:{ id:"oracle-x", symbol:"oraclex", name:"Oracle X", market_cap_rank:150 },
    coinDetails:{ categories:["Oracle", "Interoperability"], market_data:{ circulating_supply:650_000_000, total_volume:{ usd:750_000 } } },
    chain:null, stablecoinChain:null, protocol:{ name:"Oracle X", slug:"oracle-x", category:"Oracle", tvl:10_000_000 },
    marketSymbols:createMarketSymbols("ORACLEX"),
  });

  assert.equal(doge.category, PROJECT_CATEGORIES.MEME);
  assert.equal(doge.analysisProfile, ANALYSIS_PROFILES.MEME_ASSET);
  assert.equal(doge.capabilities.hasNarrativeMomentum, true);
  assert.deepEqual(doge.categories, ["Meme", "Dog-Themed", "Solana Ecosystem"]);
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


test("dynamic label inference normalizes, ranks, deduplicates, and limits runtime labels", () => {
  const labels = inferRuntimeLabels({
    coinDetails: {
      categories: ["Decentralized Exchange (DEX)", "Real World Assets (RWA)", "Artificial Intelligence", "Arbitrum Ecosystem", "Decentralized Exchange (DEX)", "Alleged SEC Securities"],
      tags: ["Perpetuals"],
      description: { en:"A utility token used for trading and governance." },
    },
    protocol: { category:"Derivatives", revenue24h:100 },
    category:PROJECT_CATEGORIES.DEFI,
    signals:{ isDefi:true, hasProtocolFees:true },
  });

  assert.deepEqual(labels, ["DEX", "Perpetuals", "RWA", "AI", "Derivatives"]);
  assert.equal(new Set(labels).size, labels.length);
  assert.ok(labels.every((label) => label.length <= 24));
  assert.equal(normalizeRuntimeLabel("Liquid Staking Derivatives"), "Liquid Staking");
  assert.equal(normalizeRuntimeLabel("Alleged SEC Securities"), null);
});

test("less-known runtime projects get cautious labels from metadata and profile signals", () => {
  const mdao = buildRuntimeProjectConfig("mdao", {
    coin:{ id:"marsdao", symbol:"mdao", name:"MarsDAO" },
    coinDetails:{
      categories:["Decentralized Autonomous Organization (DAO)", "BNB Chain Ecosystem", "Governance"],
      platforms:{ "binance-smart-chain":"0x123" },
      description:{ en:"MDAO is a utility token used for governance in its ecosystem." },
      market_data:{ total_volume:{ usd:25_000 } },
    },
  });
  const sparseDefi = buildRuntimeProjectConfig("small-defi", {
    coin:{ id:"small-defi", symbol:"sdefi", name:"Small DeFi" },
    coinDetails:{ categories:[], market_data:{} },
    protocol:{ name:"Small DeFi", category:"Yield", fees24h:10 },
  });

  assert.deepEqual(mdao.categories, ["Governance", "BNB Chain Ecosystem", "Utility Token"]);
  assert.deepEqual(sparseDefi.categories, ["Yield", "Revenue"]);
  assert.ok(mdao.categories.length <= 5);
  assert.ok(sparseDefi.categories.length >= 1);
});

test("curated labels remain the source of truth for registered projects", async () => {
  for (const slug of ["btc", "eth", "bnb", "link", "hype", "sol"]) {
    const project = await resolveProject(slug, noDiscoveryCalls);
    assert.deepEqual(project.categories, PROJECTS[slug].categories);
    assert.equal(project.resolution.source, "curated");
  }
});

test("category inference favors utility over weak protocol or market-only signals", () => {
  assert.equal(inferProjectCategory({ hasProtocolData:true, hasTvl:true }), PROJECT_CATEGORIES.UTILITY);
  assert.equal(inferProjectCategory({ hasProtocolData:true, hasProtocolFees:true }), PROJECT_CATEGORIES.DEFI);
  assert.equal(inferProjectCategory({ isConsumer:true }), PROJECT_CATEGORIES.CONSUMER);
  assert.equal(inferProjectCategory({ hasChainData:true }), PROJECT_CATEGORIES.INFRA);
  assert.equal(inferProjectCategory({ isMeme:true, hasChainData:true }), PROJECT_CATEGORIES.MEME);
});

test("runtime inference does not replace curated project profiles", async () => {
  for (const input of ["btc", "eth", "sol", "bnb"]) {
    const project = await resolveProject(input, noDiscoveryCalls);
    assert.equal(project.resolution.mode, "registered");
    assert.deepEqual(getProjectProfile(project), getProjectProfile(PROJECTS[input]));
  }
});


test("runtime symbol mapping is project-specific for DOGE, PEPE, and LINK", () => {
  const cases = [
    ["doge", "dogecoin", "Dogecoin", "DOGE", "BYBIT:DOGEUSDT"],
    ["pepe", "pepe", "Pepe", "PEPE", "BYBIT:PEPEUSDT"],
    ["link", "chainlink", "Chainlink", "LINK", "BYBIT:LINKUSDT"],
  ];
  for (const [input, id, name, symbol, tradingView] of cases) {
    const project = buildRuntimeProjectConfig(input, { coin:{ id, name, symbol:symbol.toLowerCase() }, coinDetails:{ categories:[] } });
    assert.equal(project.marketSymbols.tradingView, tradingView);
    assert.equal(project.bybitSymbol, `${symbol}USDT`);
  }
});

test("successful discovery with no exact match returns project-not-found", async () => {
  const project = await resolveProject("definitely-not-a-real-project", {
    searchCoinGeckoProjects: async () => [
      { id:"unrelated-token", symbol:"other", name:"Unrelated Token", market_cap_rank:1 },
    ],
  });

  assert.equal(project, null);
});


test("market symbols keep project symbol separate and prefer Bybit", () => {
  for (const ticker of ["BTC", "ETH", "SOL", "DOGE", "PEPE", "LINK"]) {
    const symbols = createMarketSymbols(ticker);
    assert.equal(symbols.base, ticker);
    assert.equal(symbols.technical, `${ticker}USDT`);
    assert.equal(symbols.exchange, "BYBIT");
    assert.equal(symbols.tradingView, `BYBIT:${ticker}USDT`);
    assert.deepEqual(symbols.routes.map(({ exchange }) => exchange), MARKET_EXCHANGE_PRIORITY);
  }
});

test("exchange routing follows Bybit, Binance, Gate.io priority and keeps technical route aligned", async () => {
  const checked = [];
  const resolved = await resolveExchangeMarketSymbols(createMarketSymbols("PEPE"), async (route) => {
    checked.push(route.exchange);
    return route.exchange === "GATEIO";
  });
  assert.deepEqual(checked, ["BYBIT", "BINANCE", "GATEIO"]);
  assert.equal(resolved.tradingView, "GATEIO:PEPEUSDT");
  assert.deepEqual(marketTechnicalRoute(resolved), { exchange:"GATEIO", symbol:"PEPEUSDT", source:"Gate.io spot" });
});

test("exchange routing returns an honest unavailable state without another asset", async () => {
  const resolved = await resolveExchangeMarketSymbols(createMarketSymbols("NOTLISTED"), async () => false);
  assert.equal(resolved.status, "unavailable");
  assert.equal(resolved.exchange, null);
  assert.equal(resolved.tradingView, null);
  assert.equal(resolved.technical, null);
  assert.equal(marketTechnicalRoute(resolved), null);
});

test("LINK resolves as a curated oracle utility project with exchange-aware symbols", async () => {
  for (const input of ["link", "LINK", "chainlink"]) {
    const project = await resolveProject(input);
    assert.equal(project.slug, PROJECTS.link.slug);
    assert.notEqual(project.resolution.mode, "runtime");
    assert.equal(getProjectProfile(project).analysisProfile, "oracle_utility");
  }

  assert.equal(PROJECTS.link.branding.iconKey, "chainlink");
  assert.equal(PROJECTS.link.marketSymbols.tradingView, "BYBIT:LINKUSDT");
  const resolved = await resolveExchangeMarketSymbols(PROJECTS.link.marketSymbols, async (route) => route.exchange === "BYBIT" && route.symbol === "LINKUSDT");
  assert.equal(resolved.tradingView, "BYBIT:LINKUSDT");
  assert.equal(resolved.technical, "LINKUSDT");
});

test("HYPE resolves as curated Hyperliquid with exchange-aware HYPEUSDT mapping", async () => {
  const project = await resolveProject("hyperliquid", { discoverProject:async () => { throw new Error("must not discover curated HYPE"); } });
  assert.equal(project.slug, "hype");
  assert.equal(project.resolution.mode, "registered");
  assert.equal(project.coingeckoId, "hyperliquid");
  assert.deepEqual(project.marketSymbols.routes.map(({ tradingView }) => tradingView), ["BINANCE:HYPEUSDT", "BYBIT:HYPEUSDT", "GATEIO:HYPEUSDT"]);
});


test("dynamic title/subtitle inference keeps curated copy and gives runtime projects cautious positioning", async () => {
  const btc = await resolveProject("btc", noDiscoveryCalls);
  const doge = buildRuntimeProjectConfig("doge", {
    coin:{ id:"dogecoin", symbol:"doge", name:"Dogecoin" },
    coinDetails:{ categories:["Meme", "Dog-Themed Coins"], market_data:{} },
  });
  const oracle = buildRuntimeProjectConfig("oracle-x", {
    coin:{ id:"oracle-x", symbol:"orx", name:"Oracle X" },
    coinDetails:{ categories:["Oracle", "Interoperability"], description:{ en:"A decentralized oracle network." }, market_data:{} },
  });
  const mdao = buildRuntimeProjectConfig("mdao", {
    coin:{ id:"marsdao", symbol:"mdao", name:"MarsDAO" },
    coinDetails:{ categories:["Decentralized Autonomous Organization (DAO)", "BNB Chain Ecosystem", "Governance"], description:{ en:"A utility token used for governance in its ecosystem." }, market_data:{} },
  });
  const sparse = buildRuntimeProjectSkeleton("unknown-token");

  assert.deepEqual(inferTitleSubtitle(btc), { typeLine:"macro monetary asset", subtitle:null, source:"curated" });
  assert.equal(doge.presentation.typeLine, "Meme / attention asset");
  assert.match(doge.presentation.subtitle, /ликвидность|оборот|внимани/i);
  assert.equal(oracle.presentation.typeLine, "Oracle / utility asset");
  assert.match(oracle.presentation.subtitle, /adoption|интеграц/i);
  assert.equal(mdao.presentation.typeLine, "Ecosystem utility token");
  assert.match(mdao.presentation.subtitle, /использован|роли токена/i);
  assert.equal(sparse.presentation.typeLine, "Utility token");
  assert.equal(sparse.presentation.source, "fallback");
  assert.ok(sparse.presentation.subtitle.length > 20);
});
