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
  hasLiquidityData: false,
  hasNarrativeMomentum: false,
  hasTokenUtilityData: false,
  hasAdoptionData: false,
});

// Section rules are the shared contract between project profiles, report builders, and rendering.
export const SECTION_RULES = Object.freeze({
  market: { requiredAny: [], reportBlocks: ["market", "technical_bias"] },
  tokenomics: { requiredAny: ["hasTokenomics"], reportBlocks: ["tokenomics"] },
  tvl_and_capital: { requiredAny: ["hasTvl"], reportBlocks: ["capital"] },
  stablecoins: { requiredAny: ["hasStablecoins"], reportBlocks: ["capital"] },
  rwa: { requiredAny: ["hasRwa"], reportBlocks: ["capital"] },
  financials: { requiredAny: ["hasProtocolFees", "hasChainFees"], reportBlocks: ["financials"] },
  liquidity_and_trading: { requiredAny: ["hasDexVolume", "hasLiquidityData"], reportBlocks: ["liquidity"] },
  valuation: { requiredAny: [], reportBlocks: ["valuation"] },
  users_and_activity: { requiredAny: ["hasUsersData"], reportBlocks: ["users"] },
  unlocks: { requiredAny: ["hasUnlocks"], reportBlocks: ["tokenomics"] },
  whale_activity: { requiredAny: ["hasWhaleData"], reportBlocks: ["liquidity"] },
  narrative_and_news: { requiredAny: ["hasNarrativeNews"], reportBlocks: ["narrative"] },
  risks: { requiredAny: [], reportBlocks: ["risks", "watchlist"] },
  final_summary: { requiredAny: [], reportBlocks: ["profile", "final_verdict"] },
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
    aliases: ["ethereum", "ether"],
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
        "liquidity_and_trading",
        "narrative_and_news",
        "risks",
        "final_summary",
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
    reportOptions: { hideExecutiveSummary: true, compactTokenomics: true, integratedFinancials: true, preserveCuratedSemantics: true },
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
    aliases: ["solana"],
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
        hasUsersData: false,
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
        "liquidity_and_trading",
        "narrative_and_news",
        "risks",
        "final_summary",
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

// Non-routable examples document category-aware defaults for the next automation stage.
export const PROJECT_PROFILE_EXAMPLES = Object.freeze({
  utility: {
    slug: "example-utility",
    name: "Example Utility Network",
    ticker: "UTIL",
    projectType: "utility",
    projectProfile: {
      category: PROJECT_CATEGORIES.UTILITY,
      analysisProfile: ANALYSIS_PROFILES.UTILITY_TOKEN,
      capabilities: {
        hasTokenomics: true,
        hasDexVolume: true,
        hasLiquidityData: true,
        hasTokenUtilityData: true,
        hasAdoptionData: true,
        hasWhaleData: true,
        hasNarrativeNews: true,
      },
      preferredSections: ["market", "tokenomics", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"],
    },
  },
});

export function normalizeProjectInput(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function getRegisteredProject(input) {
  const normalized = normalizeProjectInput(input);
  if (!normalized) return null;
  return Object.values(PROJECTS).find((project) => [project.slug, project.ticker, project.name, project.coingeckoId, ...(project.aliases || [])]
    .some((value) => normalizeProjectInput(value) === normalized)) || null;
}

export function getProjectBySlug(slug) {
  return PROJECTS[normalizeProjectInput(slug)] || null;
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

export const SECTION_VISIBILITY = Object.freeze({
  ENABLED: "enabled",
  DISABLED_BY_PROFILE: "disabled_by_profile",
  DISABLED_BY_MISSING_DATA: "disabled_by_missing_data",
  PARTIAL: "partial",
});

export function getSectionSelection(project, dataAvailability = {}) {
  const profile = getProjectProfile(project);
  const preferred = new Set(profile.preferredSections);
  const sections = {};

  for (const [section, rule] of Object.entries(SECTION_RULES)) {
    const missingCapabilities = rule.requiredAny.length && !rule.requiredAny.some((capability) => profile.capabilities[capability])
      ? [...rule.requiredAny]
      : [];
    let status = SECTION_VISIBILITY.ENABLED;
    let reason = "selected_by_profile";

    if (!preferred.has(section)) {
      status = SECTION_VISIBILITY.DISABLED_BY_PROFILE;
      reason = "not_in_preferred_sections";
    } else if (missingCapabilities.length) {
      status = SECTION_VISIBILITY.DISABLED_BY_MISSING_DATA;
      reason = "missing_required_capability";
    } else if (dataAvailability[section] === false) {
      status = SECTION_VISIBILITY.DISABLED_BY_MISSING_DATA;
      reason = "required_data_unavailable";
    } else if (dataAvailability[section] === "partial") {
      status = SECTION_VISIBILITY.PARTIAL;
      reason = "required_data_partial";
    }

    sections[section] = {
      status,
      reason,
      requiredAny: [...rule.requiredAny],
      missingCapabilities,
      reportBlocks: [...rule.reportBlocks],
    };
  }

  const enabledSections = profile.preferredSections.filter((section) => {
    const status = sections[section]?.status;
    return status === SECTION_VISIBILITY.ENABLED || status === SECTION_VISIBILITY.PARTIAL;
  });

  return {
    preferredSections: [...profile.preferredSections],
    eligibleSections: [...profile.eligibleSections],
    enabledSections,
    sections,
  };
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
