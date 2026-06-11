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

function normalizeKey(value) {
  return normalizeProjectInput(value).replace(/[^a-z0-9]/g, "");
}

function exactMatch(values, targets) {
  const normalizedTargets = new Set(targets.map(normalizeKey).filter(Boolean));
  return values.some((value) => normalizedTargets.has(normalizeKey(value)));
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

function chooseCoinGeckoMatch(input, coins = []) {
  const key = normalizeKey(input);
  const exact = coins.filter((coin) => exactMatch([coin.id, coin.symbol, coin.name], [key]));
  return [...exact].sort((a, b) => (a.market_cap_rank || Number.MAX_SAFE_INTEGER) - (b.market_cap_rank || Number.MAX_SAFE_INTEGER))[0] || null;
}

function findChain(rows, coin) {
  return Array.isArray(rows) ? rows.find((row) => exactMatch(
    [row?.name, row?.gecko_id, row?.tokenSymbol],
    [coin?.id, coin?.symbol, coin?.name],
  )) || null : null;
}

function findProtocol(rows, coin) {
  return Array.isArray(rows) ? rows.find((row) => exactMatch(
    [row?.gecko_id, row?.symbol, row?.name, row?.slug],
    [coin?.id, coin?.symbol, coin?.name],
  )) || null : null;
}

function inferMeme(categories = []) {
  return categories.some((category) => /meme|dog-themed|cat-themed|animal/i.test(String(category)));
}

export function inferProjectCategory(signals = {}) {
  if (signals.isMeme) return PROJECT_CATEGORIES.MEME;
  if (signals.hasChainData || signals.isInfra) return PROJECT_CATEGORIES.INFRA;
  if ((signals.hasProtocolData && (signals.hasTvl || signals.hasProtocolFees || signals.hasDexVolume)) || signals.isDefi) return PROJECT_CATEGORIES.DEFI;
  if (signals.isConsumer) return PROJECT_CATEGORIES.CONSUMER;
  return PROJECT_CATEGORIES.UTILITY;
}

export function buildRuntimeProjectConfig(input, discovery) {
  const { coin, coinDetails = {}, chain = null, stablecoinChain = null, protocol = null } = discovery;
  const marketData = coinDetails?.market_data || {};
  const signals = {
    hasChainData: Boolean(chain),
    hasProtocolData: Boolean(protocol),
    hasTvl: finitePositive(chain?.tvl) || finitePositive(protocol?.tvl),
    hasStablecoins: finitePositive(stablecoinMcapUsd(stablecoinChain)),
    hasChainFees: false,
    hasProtocolFees: false,
    hasDexVolume: false,
    hasUsersData: false,
    isMeme: inferMeme(coinDetails?.categories),
    isInfra: (coinDetails?.categories || []).some((category) => /layer 1|layer-1|smart contract platform|blockchain platform/i.test(String(category))),
    isDefi: (coinDetails?.categories || []).some((category) => /decentralized finance|defi|dex|lending|yield/i.test(String(category))),
    isConsumer: (coinDetails?.categories || []).some((category) => /gaming|metaverse|social|consumer/i.test(String(category))),
  };
  const category = inferProjectCategory(signals);
  const capabilities = {
    ...CAPABILITY_DEFAULTS,
    hasTvl: signals.hasTvl,
    hasStablecoins: signals.hasStablecoins,
    hasTokenomics: [marketData.circulating_supply, marketData.total_supply, marketData.max_supply].some((value) => value != null),
    hasNarrativeNews: true,
    hasLiquidityData: finitePositive(marketData.total_volume?.usd),
    hasNarrativeMomentum: category === PROJECT_CATEGORIES.MEME,
    hasTokenUtilityData: category === PROJECT_CATEGORIES.UTILITY,
  };
  const preferredSections = [...new Set([
    ...BASE_SECTIONS,
    ...(capabilities.hasTvl ? ["tvl_and_capital"] : []),
    ...(capabilities.hasStablecoins ? ["stablecoins"] : []),
  ])].filter((section) => getEligibleSections(capabilities).includes(section));
  const ticker = String(coin.symbol || input).toUpperCase();
  const projectType = category === PROJECT_CATEGORIES.INFRA ? "l1" : category === PROJECT_CATEGORIES.DEFI ? "protocol" : category;

  return {
    slug: normalizeProjectInput(coin.symbol || input),
    name: coin.name || ticker,
    ticker,
    subtitle: `${ticker} • runtime ${category} profile`,
    projectType,
    categories: Array.isArray(coinDetails?.categories) ? coinDetails.categories.slice(0, 4) : [],
    projectProfile: { category, analysisProfile:CATEGORY_PROFILES[category], capabilities, preferredSections },
    coingeckoId: coin.id,
    ...(chain ? { defillamaChain:chain.name } : {}),
    ...(stablecoinChain ? { stablecoinChain:stablecoinChain.name || stablecoinChain.gecko_id } : {}),
    ...(protocol ? { defillamaProtocol:protocol.slug || protocol.name } : {}),
    bybitSymbol: `${ticker}USDT`,
    newsKeywords: [coin.name, coin.symbol, coin.id].filter(Boolean),
    resolution: { mode:"runtime", input:normalizeProjectInput(input), signals },
    runtimeData: { tvl:chain?.tvl ?? protocol?.tvl ?? null },
  };
}

const DEFAULT_DISCOVERY = { searchCoinGeckoProjects, fetchCoinGeckoProject, fetchDefiLlamaChains, fetchStablecoinChains, fetchDefiLlamaProtocols };

export async function resolveProject(input, discovery = DEFAULT_DISCOVERY) {
  const normalized = normalizeProjectInput(input);
  if (!normalized) return null;

  const registered = getRegisteredProject(normalized);
  if (registered) return { ...registered, resolution:{ mode:"registered", input:normalized } };

  const coins = await discovery.searchCoinGeckoProjects(normalized);
  const coin = chooseCoinGeckoMatch(normalized, coins);
  if (!coin) return null;

  const [detailsResult, chainsResult, stablecoinsResult, protocolsResult] = await Promise.allSettled([
    discovery.fetchCoinGeckoProject(coin.id),
    discovery.fetchDefiLlamaChains(),
    discovery.fetchStablecoinChains(),
    discovery.fetchDefiLlamaProtocols(),
  ]);
  const coinDetails = detailsResult.status === "fulfilled" ? detailsResult.value : {};
  const chain = findChain(chainsResult.status === "fulfilled" ? chainsResult.value : [], coin);
  const stablecoinChain = findChain(stablecoinsResult.status === "fulfilled" ? stablecoinsResult.value : [], coin);
  const protocol = chain ? null : findProtocol(protocolsResult.status === "fulfilled" ? protocolsResult.value : [], coin);

  return buildRuntimeProjectConfig(normalized, { coin, coinDetails, chain, stablecoinChain, protocol });
}
