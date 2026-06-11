import {
  ANALYSIS_PROFILES,
  CAPABILITY_DEFAULTS,
  PROJECT_CATEGORIES,
  getEligibleSections,
  getRegisteredProject,
  normalizeProjectInput,
} from "../config/projects.js";
import { stablecoinMcapUsd } from "../adapters/defillama.js";

const CATEGORY_PROFILES = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: ANALYSIS_PROFILES.L1_INFRA,
  [PROJECT_CATEGORIES.DEFI]: ANALYSIS_PROFILES.DEFI_PROTOCOL,
  [PROJECT_CATEGORIES.MEME]: ANALYSIS_PROFILES.MEME_ASSET,
  [PROJECT_CATEGORIES.CONSUMER]: ANALYSIS_PROFILES.CONSUMER_APP,
  [PROJECT_CATEGORIES.UTILITY]: ANALYSIS_PROFILES.UTILITY_TOKEN,
});

const BASE_SECTIONS = ["market", "tokenomics", "narrative_and_news", "risks", "final_summary"];

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
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

export function buildRuntimeProjectSkeleton(input) {
  const slug = normalizeProjectInput(input);
  if (!slug) return null;

  const ticker = slug.toUpperCase();
  return {
    slug,
    name: ticker,
    ticker,
    subtitle: `${ticker} • runtime project`,
    projectType: "runtime",
    categories: [],
    resolution: {
      mode: "runtime",
      source: "fallback",
      input: String(input ?? "").trim(),
      normalized: { slug, ticker },
    },
  };
}

export async function resolveProject(input) {
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

  return buildRuntimeProjectSkeleton(input);
}
