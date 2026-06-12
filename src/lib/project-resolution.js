import {
  ANALYSIS_PROFILES,
  CAPABILITY_DEFAULTS,
  PROJECT_CATEGORIES,
  getEligibleSections,
  getRegisteredProject,
  normalizeProjectInput,
} from "../config/projects.js";
import { fetchCoinGeckoProject, searchCoinGeckoProjects } from "../adapters/coingecko.js";
import { fetchDefiLlamaChains, fetchDefiLlamaProtocols, fetchStablecoinChains, stablecoinMcapUsd } from "../adapters/defillama.js";

const CATEGORY_PROFILES = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: ANALYSIS_PROFILES.L1_INFRA,
  [PROJECT_CATEGORIES.DEFI]: ANALYSIS_PROFILES.DEFI_PROTOCOL,
  [PROJECT_CATEGORIES.MEME]: ANALYSIS_PROFILES.MEME_ASSET,
  [PROJECT_CATEGORIES.CONSUMER]: ANALYSIS_PROFILES.CONSUMER_APP,
  [PROJECT_CATEGORIES.UTILITY]: ANALYSIS_PROFILES.UTILITY_TOKEN,
});

const BASE_SECTIONS = ["market", "tokenomics", "narrative_and_news", "risks", "final_summary"];
const MEME_CATEGORY = /meme|dog-themed|cat-themed|animal|community token/i;
const INFRA_CATEGORY = /layer[ -]?1|layer[ -]?2|smart contract platform|blockchain platform|blockchain infrastructure|modular blockchain/i;
const DEFI_CATEGORY = /decentralized finance|\bdefi\b|decentralized exchange|\bdex\b|lending|yield|liquid staking|derivatives/i;
const CONSUMER_CATEGORY = /gaming|metaverse|social|consumer|entertainment|fan token|nft|play to earn/i;
const KNOWN_MEME_IDENTITIES = new Set(["doge", "dogecoin", "pepe", "shib", "shiba-inu"]);


const KNOWN_PROJECT_BRANDING = Object.freeze({
  eth: { iconKey:"ethereum", accent:"#8c9eff" },
  sol: { iconKey:"solana", accent:"#14f195" },
  doge: { iconKey:"dogecoin", accent:"#c2a633" },
  pepe: { iconKey:"pepe", accent:"#63b86b" },
  link: { iconKey:"chainlink", accent:"#4a6cff" },
});

const KNOWN_MARKET_SYMBOLS = Object.freeze({
  eth: { tradingView:"BINANCE:ETHUSDT", technical:"ETHUSDT" },
  sol: { tradingView:"BINANCE:SOLUSDT", technical:"SOLUSDT" },
  doge: { tradingView:"BINANCE:DOGEUSDT", technical:"DOGEUSDT" },
  pepe: { tradingView:"BINANCE:PEPEUSDT", technical:"PEPEUSDT" },
  link: { tradingView:"BINANCE:LINKUSDT", technical:"LINKUSDT" },
});

const KNOWN_PROJECT_NEWS_FEEDS = Object.freeze({
  doge: [{ url:"https://foundation.dogecoin.com/blog/index.xml", source:"Dogecoin Foundation", priority:1, audience:"official" }],
  link: [{ url:"https://blog.chain.link/rss/", source:"Chainlink Blog", priority:1, audience:"official" }],
});

const KNOWN_NEWS_CONTEXT = Object.freeze({
  doge: ["dogecoin", "doge", "dogecoin payment", "dogecoin adoption", "doge whale", "doge listing", "elon musk dogecoin", "elon musk doge"],
  pepe: ["pepe", "pepe coin", "pepe whale", "pepe liquidity", "pepe listing", "pepe sentiment"],
  link: ["chainlink", "link", "chainlink ccip", "chainlink oracle", "chainlink staking"],
});

function runtimeBranding(coin, ticker) {
  const known = KNOWN_PROJECT_BRANDING[String(ticker || "").toLowerCase()] || KNOWN_PROJECT_BRANDING[String(coin?.id || "").toLowerCase()];
  const iconUrl = coin?.image?.large || coin?.image?.small || coin?.image?.thumb;
  return { ...(known || {}), ...(typeof iconUrl === "string" && /^https:\/\//i.test(iconUrl) ? { iconUrl } : {}) };
}

function runtimeNewsRelevance(coin, ticker) {
  const key = String(ticker || "").toLowerCase();
  const directTerms = [...new Set([coin?.name, coin?.id, coin?.symbol, ticker].filter(Boolean))];
  return {
    mode:"strict",
    directTerms,
    contextTerms: KNOWN_NEWS_CONTEXT[key] || directTerms,
    competingTerms: ["bitcoin", "btc", "ethereum", "ether", "eth", "solana", "sol", "xrp", "dogecoin", "doge", "pepe"].filter((term) => !directTerms.map((value) => String(value).toLowerCase()).includes(term)),
  };
}

function runtimeCategories(categories, category) {
  const useful = {
    [PROJECT_CATEGORIES.MEME]: /meme|dog-themed|frog-themed|cat-themed|community token/i,
    [PROJECT_CATEGORIES.INFRA]: /layer[ -]?1|layer[ -]?2|smart contract|blockchain infrastructure/i,
    [PROJECT_CATEGORIES.DEFI]: /defi|decentralized exchange|lending|yield|staking|derivatives/i,
    [PROJECT_CATEGORIES.UTILITY]: /oracle|interoperability|data availability|storage|identity|utility/i,
    [PROJECT_CATEGORIES.CONSUMER]: /gaming|social|consumer|entertainment|nft/i,
  }[category];
  return categories.filter((value) => useful?.test(String(value))).slice(0, 3);
}

const DEFAULT_DISCOVERY = Object.freeze({
  searchCoinGeckoProjects,
  fetchCoinGeckoProject,
  fetchDefiLlamaChains,
  fetchDefiLlamaProtocols,
  fetchStablecoinChains,
});

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function matchesCategory(categories, pattern) {
  return categories.some((category) => pattern.test(String(category)));
}

function normalizedIdentityValues(row, fields) {
  return fields.map((field) => normalizeProjectInput(row?.[field])).filter(Boolean);
}

function findDiscoveryMatch(rows, coin, fields) {
  if (!Array.isArray(rows)) return null;
  const identities = new Set([coin?.id, coin?.name, coin?.symbol].map(normalizeProjectInput).filter(Boolean));
  return rows.find((row) => normalizedIdentityValues(row, fields).some((value) => identities.has(value))) || null;
}

function selectCoinMatch(rows, input) {
  const normalized = normalizeProjectInput(input);
  if (!Array.isArray(rows) || !normalized) return null;
  return rows
    .map((coin) => ({
      coin,
      rank: normalizeProjectInput(coin?.symbol) === normalized ? 3 : normalizeProjectInput(coin?.id) === normalized ? 2 : normalizeProjectInput(coin?.name) === normalized ? 1 : 0,
      marketCapRank: Number.isFinite(Number(coin?.market_cap_rank)) ? Number(coin.market_cap_rank) : Number.MAX_SAFE_INTEGER,
    }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank || a.marketCapRank - b.marketCapRank)[0]?.coin || null;
}

function inferIdentitySignals(input) {
  return { isMeme:KNOWN_MEME_IDENTITIES.has(normalizeProjectInput(input)) };
}

function buildCapabilitySeed(category, signals, marketData = {}) {
  return {
    ...CAPABILITY_DEFAULTS,
    hasTvl: Boolean(signals.hasTvl),
    hasStablecoins: Boolean(signals.hasStablecoins),
    hasProtocolFees: Boolean(signals.hasProtocolFees),
    hasChainFees: Boolean(signals.hasChainFees),
    hasDexVolume: Boolean(signals.hasDexVolume),
    hasUsersData: Boolean(signals.hasUsersData),
    hasTokenomics: [marketData.circulating_supply, marketData.total_supply, marketData.max_supply].some((value) => value != null),
    hasNarrativeNews: true,
    hasLiquidityData: finitePositive(marketData.total_volume?.usd),
    hasNarrativeMomentum: category === PROJECT_CATEGORIES.MEME,
    hasTokenUtilityData: category === PROJECT_CATEGORIES.UTILITY && Boolean(signals.hasUtilitySignals),
  };
}

function buildPreferredSections(capabilities, category) {
  return [...new Set([
    ...BASE_SECTIONS,
    ...(capabilities.hasTvl ? ["tvl_and_capital"] : []),
    ...(capabilities.hasStablecoins ? ["stablecoins"] : []),
    ...(capabilities.hasProtocolFees || capabilities.hasChainFees ? ["financials"] : []),
    ...(capabilities.hasDexVolume || capabilities.hasLiquidityData ? ["liquidity_and_trading"] : []),
    ...(category === PROJECT_CATEGORIES.UTILITY ? ["valuation"] : []),
    ...(capabilities.hasUsersData ? ["users_and_activity"] : []),
  ])].filter((section) => getEligibleSections(capabilities).includes(section));
}

function buildProfile(category, capabilities) {
  return {
    category,
    analysisProfile: CATEGORY_PROFILES[category],
    capabilities,
    preferredSections: buildPreferredSections(capabilities, category),
  };
}

function withProfile(project, profile) {
  return {
    ...project,
    category: profile.category,
    analysisProfile: profile.analysisProfile,
    capabilities: profile.capabilities,
    preferredSections: profile.preferredSections,
    projectProfile: profile,
  };
}

export function inferProjectCategory(signals = {}) {
  if (signals.isMeme) return PROJECT_CATEGORIES.MEME;
  if (signals.hasChainData || signals.isInfra) return PROJECT_CATEGORIES.INFRA;
  if (signals.isDefi || (signals.hasProtocolData && (signals.hasProtocolFees || signals.hasDexVolume))) return PROJECT_CATEGORIES.DEFI;
  if (signals.isConsumer) return PROJECT_CATEGORIES.CONSUMER;
  return PROJECT_CATEGORIES.UTILITY;
}

export function buildRuntimeProjectConfig(input, discovery) {
  const { coin, coinDetails = {}, chain = null, stablecoinChain = null, protocol = null } = discovery;
  const categories = Array.isArray(coinDetails?.categories) ? coinDetails.categories : [];
  const marketData = coinDetails?.market_data || {};
  const protocolCategories = [protocol?.category, protocol?.type].filter(Boolean);
  const signals = {
    hasChainData: Boolean(chain),
    hasProtocolData: Boolean(protocol),
    hasTvl: finitePositive(chain?.tvl) || finitePositive(protocol?.tvl),
    hasStablecoins: finitePositive(stablecoinMcapUsd(stablecoinChain)),
    hasChainFees: finitePositive(chain?.fees24h) || finitePositive(chain?.dailyFees),
    hasProtocolFees: finitePositive(protocol?.fees24h) || finitePositive(protocol?.dailyFees) || finitePositive(protocol?.revenue24h),
    hasDexVolume: finitePositive(protocol?.volume24h) || finitePositive(protocol?.dailyVolume),
    hasUsersData: finitePositive(chain?.activeUsers) || finitePositive(protocol?.activeUsers),
    hasUtilitySignals: matchesCategory(categories, /oracle|interoperability|data availability|storage|identity|utility/i),
    isMeme: matchesCategory(categories, MEME_CATEGORY) || [input, coin.id, coin.name, coin.symbol].some((value) => inferIdentitySignals(value).isMeme),
    isInfra: matchesCategory(categories, INFRA_CATEGORY),
    isDefi: matchesCategory(categories, DEFI_CATEGORY) || matchesCategory(protocolCategories, DEFI_CATEGORY),
    isConsumer: matchesCategory(categories, CONSUMER_CATEGORY),
  };
  const category = inferProjectCategory(signals);
  const capabilities = buildCapabilitySeed(category, signals, marketData);
  const profile = buildProfile(category, capabilities);
  const ticker = String(coin.symbol || input).toUpperCase();
  const projectType = category === PROJECT_CATEGORIES.INFRA ? "l1" : category === PROJECT_CATEGORIES.DEFI ? "protocol" : category;
  const knownSymbols = KNOWN_MARKET_SYMBOLS[ticker.toLowerCase()];
  const marketSymbols = knownSymbols || { tradingView:`BINANCE:${ticker}USDT`, technical:`${ticker}USDT` };

  return withProfile({
    slug: normalizeProjectInput(coin.symbol || input),
    name: coin.name || ticker,
    ticker,
    subtitle: `${ticker} • runtime ${category} profile`,
    projectType,
    categories: runtimeCategories(categories, category),
    coingeckoId: coin.id,
    ...(chain ? { defillamaChain:chain.name } : {}),
    ...(stablecoinChain ? { stablecoinChain:stablecoinChain.name || stablecoinChain.gecko_id } : {}),
    ...(protocol ? { defillamaProtocol:protocol.slug || protocol.name } : {}),
    marketSymbols,
    bybitSymbol: marketSymbols.technical,
    ...(KNOWN_PROJECT_NEWS_FEEDS[ticker.toLowerCase()] ? { projectNewsFeeds:KNOWN_PROJECT_NEWS_FEEDS[ticker.toLowerCase()] } : {}),
    newsKeywords: [coin.name, coin.symbol, coin.id].filter(Boolean),
    newsRelevance: runtimeNewsRelevance(coin, ticker),
    branding: runtimeBranding(coinDetails, ticker),
    resolution: { mode:"runtime", source:"discovery", input:String(input ?? "").trim(), normalized:{ slug:normalizeProjectInput(coin.symbol || input), ticker }, signals },
    runtimeData: { tvl:chain?.tvl ?? protocol?.tvl ?? null },
  }, profile);
}

export function buildRuntimeProjectSkeleton(input) {
  const slug = normalizeProjectInput(input);
  if (!slug) return null;

  const ticker = slug.toUpperCase();
  const signals = inferIdentitySignals(input);
  const category = inferProjectCategory(signals);
  const profile = buildProfile(category, buildCapabilitySeed(category, signals));
  const symbolTicker = ticker.replace(/[^A-Z0-9]/g, "");
  const marketSymbols = KNOWN_MARKET_SYMBOLS[slug] || { tradingView:`BINANCE:${symbolTicker}USDT`, technical:`${symbolTicker}USDT` };
  return withProfile({
    slug,
    name: ticker,
    ticker,
    subtitle: `${ticker} • runtime ${category} profile`,
    projectType: "runtime",
    categories: [],
    marketSymbols,
    bybitSymbol:marketSymbols.technical,
    ...(KNOWN_PROJECT_NEWS_FEEDS[slug] ? { projectNewsFeeds:KNOWN_PROJECT_NEWS_FEEDS[slug] } : {}),
    newsRelevance: { mode:"strict", directTerms:[ticker, slug], contextTerms:[ticker, slug], competingTerms:[] },
    branding: KNOWN_PROJECT_BRANDING[slug] || { iconKey:"fallback" },
    resolution: {
      mode: "runtime",
      source: "fallback",
      input: String(input ?? "").trim(),
      normalized: { slug, ticker },
      signals,
    },
  }, profile);
}

async function discoverRuntimeProject(input, discovery) {
  const searchRows = await discovery.searchCoinGeckoProjects(input);
  const coin = selectCoinMatch(searchRows, input);
  if (!coin) return null;

  const [coinDetailsResult, chainsResult, stablecoinsResult, protocolsResult] = await Promise.allSettled([
    discovery.fetchCoinGeckoProject(coin.id),
    discovery.fetchDefiLlamaChains(),
    discovery.fetchStablecoinChains(),
    discovery.fetchDefiLlamaProtocols(),
  ]);
  const coinDetails = coinDetailsResult.status === "fulfilled" ? coinDetailsResult.value : {};
  const chains = chainsResult.status === "fulfilled" ? chainsResult.value : [];
  const stablecoinChains = stablecoinsResult.status === "fulfilled" ? stablecoinsResult.value : [];
  const protocols = protocolsResult.status === "fulfilled" ? protocolsResult.value : [];

  return buildRuntimeProjectConfig(input, {
    coin,
    coinDetails,
    chain: findDiscoveryMatch(chains, coin, ["gecko_id", "name"]),
    stablecoinChain: findDiscoveryMatch(stablecoinChains, coin, ["gecko_id", "name", "tokenSymbol"]),
    protocol: findDiscoveryMatch(protocols, coin, ["gecko_id", "slug", "name"]),
  });
}

export async function resolveProject(input, discovery = DEFAULT_DISCOVERY) {
  const normalized = normalizeProjectInput(input);
  if (!normalized) return null;

  const registered = getRegisteredProject(normalized);
  if (registered) {
    return {
      ...registered,
      resolution: {
        mode: "registered",
        source: "curated",
        input: String(input ?? "").trim(),
        normalized: { slug:registered.slug, ticker:registered.ticker },
      },
    };
  }

  try {
    return await discoverRuntimeProject(input, discovery);
  } catch {
    // Keep a conservative runtime fallback when discovery itself is unavailable.
    // A successful discovery with no exact identity match is an unknown project.
    return buildRuntimeProjectSkeleton(input);
  }
}
