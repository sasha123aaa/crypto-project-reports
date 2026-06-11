const USERS_SOURCE_EXAMPLES = {
  custom_json: {
    type: "custom_json",
    endpoint: "/data/users/<project-slug>.json",
    label: "Custom users feed",
    dataset: "standard_users_v1",
  },
};

export const PROJECT_CATEGORIES = Object.freeze({
  INFRA: "infra",
  DEFI: "defi",
  MEME: "meme",
  UTILITY: "utility",
  CONSUMER: "consumer",
});

export const ANALYSIS_PROFILES = Object.freeze({
  L1_INFRA: "l1_infra",
  DEFI_PROTOCOL: "defi_protocol",
  MEME_ASSET: "meme_asset",
  UTILITY_TOKEN: "utility_token",
  CONSUMER_APP: "consumer_app",
});

export const CAPABILITY_DEFAULTS = Object.freeze({
  hasTvl: false,
  hasStablecoins: false,
  hasRwa: false,
  hasProtocolFees: false,
  hasChainFees: false,
  hasDexVolume: false,
  hasUsersData: false,
  hasTokenomics: false,
  hasUnlocks: false,
  hasWhaleData: false,
  hasNarrativeNews: false,
});

// This is a declarative foundation for later rendering changes. Stage 1 does not
// hide or reorder existing report blocks based on these rules.
export const SECTION_RULES = Object.freeze({
  market: { requiredAny: [], reportBlocks: ["market", "technical_bias"] },
  tokenomics: { requiredAny: ["hasTokenomics"], reportBlocks: ["tokenomics"] },
  tvl_and_capital: { requiredAny: ["hasTvl"], reportBlocks: ["capital"] },
  stablecoins: { requiredAny: ["hasStablecoins"], reportBlocks: ["capital"] },
  rwa: { requiredAny: ["hasRwa"], reportBlocks: ["capital"] },
  financials: { requiredAny: ["hasProtocolFees", "hasChainFees"], reportBlocks: ["financials"] },
  dex_activity: { requiredAny: ["hasDexVolume"], reportBlocks: ["financials", "liquidity"] },
  users_and_activity: { requiredAny: ["hasUsersData"], reportBlocks: ["users"] },
  unlocks: { requiredAny: ["hasUnlocks"], reportBlocks: ["tokenomics"] },
  whale_activity: { requiredAny: ["hasWhaleData"], reportBlocks: ["liquidity"] },
  narrative_and_news: { requiredAny: ["hasNarrativeNews"], reportBlocks: ["narrative"] },
  risks_and_verdict: { requiredAny: [], reportBlocks: ["risks", "watchlist", "final_verdict"] },
});

// Keep this layer limited to stable, publisher-backed public feeds.
export const UNIVERSAL_NEWS_FEEDS = [
  {
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    source: "CoinDesk",
    priority: 20,
    audience: "market",
    layer: "universal",
  },
];

export const PROJECTS = {
  eth: {
    slug: "eth",
    name: "Ethereum",
    ticker: "ETH",
    subtitle: "ETH • infrastructure asset",
    projectType: "l1",
    categories: ["L1", "DeFi", "Smart Contracts"],
    projectProfile: {
      category: PROJECT_CATEGORIES.INFRA,
      analysisProfile: ANALYSIS_PROFILES.L1_INFRA,
      capabilities: {
        hasTvl: true,
        hasStablecoins: true,
        hasRwa: true,
        hasProtocolFees: true,
        hasChainFees: true,
        hasDexVolume: true,
        hasUsersData: true,
        hasTokenomics: true,
        hasNarrativeNews: true,
      },
      preferredSections: [
        "market",
        "tvl_and_capital",
        "financials",
        "users_and_activity",
        "tokenomics",
        "stablecoins",
        "rwa",
        "dex_activity",
        "narrative_and_news",
        "risks_and_verdict",
      ],
    },
    coingeckoId: "ethereum",
    defillamaChain: "Ethereum",
    stablecoinChain: "Ethereum",
    rwaChain: "Ethereum",
    newsKeywords: ["ethereum", "ether", "eth"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["ethereum", "ether", "eth"],
      contextTerms: ["ethereum foundation", "ethereum upgrade", "ethereum staking", "ethereum etf", "ethereum l2", "ethereum layer 2", "ethereum defi", "eth staking", "eth etf"],
      competingTerms: ["bitcoin", "btc", "solana", "sol", "xrp", "dogecoin", "doge"],
    },
    excludedNewsSources: ["Ethereum Research"],
    projectNewsFeeds: [
      { url: "https://blog.ethereum.org/feed.xml", source: "Ethereum Blog", priority: 1, audience: "official" },
      { url: "https://weekinethereumnews.com/feed/", source: "Week in Ethereum News", priority: 2, audience: "ecosystem" },
      { url: "https://medium.com/feed/ethereum-cat-herders", source: "Ethereum Cat Herders", priority: 3, audience: "ecosystem" },
    ],
    reportOptions: { hideExecutiveSummary: true, compactTokenomics: true, integratedFinancials: true },
    usersSource: {
      type: "none",
      chain: "Ethereum",
      label: "Users provider is not configured"
    },
    bybitSymbol: "ETHUSDT",
    tags: ["L1", "DeFi", "Smart Contracts"]
  },
  sol: {
    slug: "sol",
    name: "Solana",
    ticker: "SOL",
    subtitle: "SOL • infrastructure asset",
    projectType: "l1",
    categories: ["L1", "DeFi", "Smart Contracts"],
    projectProfile: {
      category: PROJECT_CATEGORIES.INFRA,
      analysisProfile: ANALYSIS_PROFILES.L1_INFRA,
      capabilities: {
        hasTvl: true,
        hasStablecoins: true,
        hasProtocolFees: true,
        hasChainFees: true,
        hasDexVolume: true,
        hasUsersData: true,
        hasTokenomics: true,
        hasNarrativeNews: true,
      },
      preferredSections: [
        "market",
        "tvl_and_capital",
        "financials",
        "users_and_activity",
        "tokenomics",
        "stablecoins",
        "dex_activity",
        "narrative_and_news",
        "risks_and_verdict",
      ],
    },
    coingeckoId: "solana",
    defillamaChain: "Solana",
    stablecoinChain: "Solana",
    newsKeywords: ["solana", "sol"],
    usersSource: {
      type: "none",
      chain: "Solana",
      label: "Users provider is not configured"
    },
    bybitSymbol: "SOLUSDT",
    tags: ["L1", "DeFi", "Smart Contracts"]
  }
};

export function getProjectBySlug(slug) {
  return PROJECTS[slug?.toLowerCase()] || null;
}

export function getProjectProfile(project) {
  const configuredProfile = project?.projectProfile || {};
  const capabilities = { ...CAPABILITY_DEFAULTS, ...(configuredProfile.capabilities || {}) };
  const preferredSections = Array.isArray(configuredProfile.preferredSections)
    ? configuredProfile.preferredSections.filter((section) => SECTION_RULES[section])
    : [];

  return {
    category: configuredProfile.category || PROJECT_CATEGORIES.UTILITY,
    analysisProfile: configuredProfile.analysisProfile || ANALYSIS_PROFILES.UTILITY_TOKEN,
    capabilities,
    preferredSections,
    eligibleSections: getEligibleSections(capabilities),
  };
}

export function getEligibleSections(capabilities = {}) {
  const resolvedCapabilities = { ...CAPABILITY_DEFAULTS, ...capabilities };
  return Object.entries(SECTION_RULES)
    .filter(([, rule]) => !rule.requiredAny.length || rule.requiredAny.some((capability) => resolvedCapabilities[capability]))
    .map(([section]) => section);
}

export function getUsersSourceExamples() {
  return USERS_SOURCE_EXAMPLES;
}

export function getNewsFeeds(project) {
  const excludedSources = new Set((project?.excludedNewsSources || []).map((source) => String(source).toLowerCase()));
  const feeds = Array.isArray(project?.newsFeeds)
    ? project.newsFeeds
    : [
      ...UNIVERSAL_NEWS_FEEDS,
      ...(Array.isArray(project?.projectNewsFeeds) ? project.projectNewsFeeds : []).map((feed) => ({ ...feed, layer: feed.layer || "project" })),
    ];
  return feeds.filter((feed) => !excludedSources.has(String(feed?.source || "").toLowerCase()));
}
