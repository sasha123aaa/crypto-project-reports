import { createMarketSymbols } from "../lib/market-symbols.js";
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
  MACRO: "macro",
  DEFI: "defi",
  MEME: "meme",
  UTILITY: "utility",
  CONSUMER: "consumer",
  HYBRID_ECOSYSTEM: "hybrid_ecosystem",
  ECOSYSTEM_GROWTH: "ecosystem_growth",
  TRADING_VENUE: "trading_venue",
});

export const ANALYSIS_PROFILES = Object.freeze({
  L1_INFRA: "l1_infra",
  MACRO_ASSET: "macro_asset",
  DEFI_PROTOCOL: "defi_protocol",
  MEME_ASSET: "meme_asset",
  UTILITY_TOKEN: "utility_token",
  ORACLE_UTILITY: "oracle_utility",
  CONSUMER_APP: "consumer_app",
  CEX_CHAIN_HYBRID: "cex_chain_hybrid",
  INFRA_ECOSYSTEM_GROWTH: "infra_ecosystem_growth",
  TRADING_ECONOMICS: "trading_economics",
  PRODUCT_DEFI_ECONOMICS: "product_defi_economics",
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
  hasBtcValuationData: false,
  hasDemandFlowData: false,
  hasValueCaptureData: false,
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
  demand_and_flows: { requiredAny: ["hasDemandFlowData"], reportBlocks: ["demand_flows"] },
  users_and_activity: { requiredAny: ["hasUsersData"], reportBlocks: ["users"] },
  unlocks: { requiredAny: ["hasUnlocks"], reportBlocks: ["tokenomics"] },
  whale_activity: { requiredAny: ["hasWhaleData"], reportBlocks: ["liquidity"] },
  utility_and_adoption: { requiredAny: ["hasTokenUtilityData", "hasAdoptionData"], reportBlocks: ["utility_adoption", "semantic_metrics"] },
  narrative_and_news: { requiredAny: ["hasNarrativeNews"], reportBlocks: ["narrative"] },
  risks: { requiredAny: [], reportBlocks: ["risks", "watchlist"] },
  final_summary: { requiredAny: [], reportBlocks: ["profile", "final_verdict"] },
});

// Keep this layer limited to stable, publisher-backed public feeds.
export const UNIVERSAL_NEWS_FEEDS = [
  { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk", priority: 20, audience: "market", layer: "universal" },
  { url: "https://decrypt.co/feed", source: "Decrypt", priority: 21, audience: "market", layer: "universal" },
  { url: "https://cointelegraph.com/rss", source: "Cointelegraph", priority: 22, audience: "market", layer: "universal" },
];

export const PROJECTS = {
  btc: {
    slug: "btc",
    name: "Bitcoin",
    ticker: "BTC",
    aliases: ["bitcoin", "xbt"],
    subtitle: "BTC • macro monetary asset",
    branding: { iconKey: "bitcoin", accent: "#f7931a" },
    projectType: "macro_asset",
    categories: ["Macro Asset", "Store of Value", "Proof of Work"],
    projectProfile: {
      category: PROJECT_CATEGORIES.MACRO,
      analysisProfile: ANALYSIS_PROFILES.MACRO_ASSET,
      capabilities: {
        hasTokenomics: true,
        hasNarrativeNews: true,
        hasLiquidityData: true,
        hasBtcValuationData: true,
        hasDemandFlowData: true,
      },
      preferredSections: [
        "market",
        "tokenomics",
        "liquidity_and_trading",
        "valuation",
        "demand_and_flows",
        "narrative_and_news",
        "risks",
        "final_summary",
      ],
    },
    coingeckoId: "bitcoin",
    newsKeywords: ["bitcoin", "btc"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["bitcoin", "btc"],
      contextTerms: ["bitcoin etf", "spot bitcoin etf", "bitcoin treasury", "bitcoin reserve", "bitcoin mining", "bitcoin liquidity", "bitcoin dominance", "institutional bitcoin", "btc etf"],
      competingTerms: ["ethereum", "ether", "eth", "solana", "sol", "xrp", "dogecoin", "doge", "pepe"],
    },
    newsLimit: 5,
    reportOptions: { compactTokenomics: true },
    marketSymbols: createMarketSymbols("BTC"),
    bybitSymbol: "BTCUSDT",
    tags: ["Macro Asset", "Store of Value", "Proof of Work"],
  },
  eth: {
    slug: "eth",
    name: "Ethereum",
    ticker: "ETH",
    aliases: ["ethereum", "ether"],
    subtitle: "ETH • infrastructure asset",
    branding: { iconKey: "ethereum", accent: "#8c9eff" },
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
    reportOptions: { compactTokenomics: true, integratedFinancials: true },
    usersSource: {
      type: "none",
      chain: "Ethereum",
      label: "Users provider is not configured"
    },
    marketSymbols: createMarketSymbols("ETH"),
    bybitSymbol: "ETHUSDT",
    tags: ["L1", "DeFi", "Smart Contracts"]
  },
  bnb: {
    slug: "bnb",
    name: "BNB",
    ticker: "BNB",
    aliases: ["binancecoin", "binance coin", "bnb chain"],
    subtitle: "BNB • exchange + chain ecosystem asset",
    branding: { iconKey: "bnb", accent: "#f3ba2f" },
    projectType: "hybrid_ecosystem_asset",
    categories: ["CEX Utility", "BNB Chain", "Burn", "Ecosystem Asset"],
    projectProfile: {
      category: PROJECT_CATEGORIES.HYBRID_ECOSYSTEM,
      analysisProfile: ANALYSIS_PROFILES.CEX_CHAIN_HYBRID,
      capabilities: {
        hasTvl: true,
        hasStablecoins: true,
        hasChainFees: true,
        hasDexVolume: true,
        hasTokenomics: true,
        hasNarrativeNews: true,
        hasLiquidityData: true,
        hasTokenUtilityData: true,
        hasAdoptionData: true,
      },
      preferredSections: [
        "market",
        "tokenomics",
        "financials",
        "tvl_and_capital",
        "stablecoins",
        "liquidity_and_trading",
        "final_summary",
        "risks",
        "narrative_and_news",
      ],
    },
    coingeckoId: "binancecoin",
    defillamaChain: "BSC",
    stablecoinChain: "BSC",
    newsKeywords: ["bnb", "bnb chain", "binance ecosystem", "binance coin"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["bnb", "bnb chain", "binance coin"],
      contextTerms: ["bnb burn", "bnb auto burn", "bnb token burn", "bnb chain upgrade", "bnb chain ecosystem", "binance ecosystem", "binance launchpool", "binance launchpad", "binance regulatory", "binance regulation"],
      competingTerms: ["bitcoin", "btc", "ethereum", "ether", "eth", "solana", "sol", "xrp", "dogecoin", "doge", "pepe"],
    },
    projectNewsFeeds: [
      { url: "https://news.google.com/rss/search?q=site%3Abinance.com%2Fen%2Fblog+%28BNB+OR+%22BNB+Chain%22+OR+%22BNB+burn%22%29&hl=en-US&gl=US&ceid=US%3Aen", source: "Binance Blog", priority: 1, audience: "official" },
      { url: "https://news.google.com/rss/search?q=site%3Abnbchain.org%2Fen%2Fblog+%28BNB+OR+%22BNB+Chain%22+OR+burn%29&hl=en-US&gl=US&ceid=US%3Aen", source: "BNB Chain Blog", priority: 2, audience: "official" },
    ],
    newsLimit: 5,
    reportOptions: { preserveCuratedSemantics: false },
    marketSymbols: createMarketSymbols("BNB", { exchanges:["BINANCE", "BYBIT", "GATEIO"] }),
    bybitSymbol: "BNBUSDT",
    tags: ["CEX Utility", "BNB Chain", "Burn", "Ecosystem Asset"],
  },
  hype: {
    slug: "hype",
    name: "Hyperliquid",
    ticker: "HYPE",
    aliases: ["hyperliquid", "hyperliquid hype"],
    subtitle: "HYPE • trading venue / revenue-driven growth asset",
    branding: { iconKey: "hyperliquid", accent: "#97fce4" },
    projectType: "trading_venue_asset",
    categories: ["DEX", "Perpetuals", "Trading Venue", "Revenue", "Value Capture"],
    projectProfile: {
      category: PROJECT_CATEGORIES.TRADING_VENUE,
      analysisProfile: ANALYSIS_PROFILES.TRADING_ECONOMICS,
      capabilities: {
        hasTvl: true,
        hasStablecoins: true,
        hasProtocolFees: true,
        hasDexVolume: true,
        hasTokenomics: true,
        hasNarrativeNews: true,
        hasLiquidityData: true,
        hasTokenUtilityData: true,
        hasAdoptionData: true,
        hasValueCaptureData: true,
      },
      preferredSections: [
        "market",
        "tokenomics",
        "financials",
        "liquidity_and_trading",
        "tvl_and_capital",
        "stablecoins",
        "final_summary",
        "risks",
        "narrative_and_news",
      ],
    },
    coingeckoId: "hyperliquid",
    defillamaChain: "Hyperliquid",
    stablecoinChain: "Hyperliquid",
    newsKeywords: ["hyperliquid", "hype token", "hype buyback", "hyperliquid dex"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["hyperliquid", "hype token", "hyperliquid dex", "hyperliquid protocol"],
      contextTerms: ["hyperliquid volume", "hyperliquid fees", "hyperliquid revenue", "hyperliquid buyback", "assistance fund", "hyperliquid liquidity", "hyperliquid traders", "hyperliquid ecosystem", "hyperliquid update", "hyperliquid adoption"],
      competingTerms: ["bitcoin", "btc", "ethereum", "ether", "eth", "solana", "sol", "dogecoin", "doge", "pepe", "uniswap", "aave"],
    },
    projectNewsFeeds: [
      { url: "https://news.google.com/rss/search?q=%28Hyperliquid+OR+%22HYPE+token%22%29+%28volume+OR+fees+OR+revenue+OR+buyback+OR+liquidity+OR+update%29&hl=en-US&gl=US&ceid=US%3Aen", source: "Hyperliquid News", priority: 1, audience: "ecosystem" },
    ],
    newsLimit: 5,
    reportOptions: { preserveCuratedSemantics: false, heroKpis:["price", "market_cap", "fdv", "volume_24h", "protocol_fees", "dex_volume", "tvl", "value_capture"], heroKpiLimit:8 },
    marketSymbols: createMarketSymbols("HYPE", { exchanges:["BINANCE", "BYBIT", "GATEIO"] }),
    bybitSymbol: "HYPEUSDT",
    tags: ["DEX", "Perpetuals", "Trading Venue", "Revenue", "Value Capture"],
  },
  pendle: {
    slug: "pendle",
    name: "Pendle",
    ticker: "PENDLE",
    aliases: ["pendle finance"],
    subtitle: "PENDLE • yield trading / product-driven DeFi asset",
    branding: { iconKey: "pendle", accent: "#55d5c8" },
    projectType: "product_driven_defi_asset",
    categories: ["DeFi", "Yield Trading", "PT / YT", "Revenue", "Value Capture"],
    projectProfile: {
      category: PROJECT_CATEGORIES.DEFI,
      analysisProfile: ANALYSIS_PROFILES.PRODUCT_DEFI_ECONOMICS,
      capabilities: { hasTvl:true, hasProtocolFees:true, hasDexVolume:true, hasTokenomics:true, hasNarrativeNews:true, hasLiquidityData:true, hasTokenUtilityData:true, hasAdoptionData:true, hasValueCaptureData:true },
      preferredSections: ["market", "tokenomics", "financials", "liquidity_and_trading", "tvl_and_capital", "final_summary", "risks", "narrative_and_news"],
    },
    coingeckoId: "pendle",
    defillamaChain: "Pendle",
    newsKeywords: ["pendle", "pendle finance", "pt yt"],
    newsRelevance: { mode:"strict", directTerms:["pendle", "pendle finance", "pendle token"], contextTerms:["pendle tvl", "pendle yield", "pendle pt", "pendle yt", "pendle fees", "pendle revenue", "pendle trading"], competingTerms:["bitcoin", "btc", "ethereum", "solana", "hyperliquid", "curve"] },
    projectNewsFeeds: [{ url:"https://news.google.com/rss/search?q=Pendle+Finance+%28TVL+OR+yield+OR+fees+OR+PT+OR+YT%29&hl=en-US&gl=US&ceid=US%3Aen", source:"Pendle News", priority:1, audience:"ecosystem" }],
    newsLimit: 5,
    reportOptions: { preserveCuratedSemantics:false, heroKpis:["price", "market_cap", "fdv", "volume_24h", "tvl", "protocol_fees", "dex_volume", "token_utility"], heroKpiLimit:8 },
    marketSymbols: createMarketSymbols("PENDLE", { exchanges:["BINANCE", "BYBIT", "GATEIO"] }),
    bybitSymbol: "PENDLEUSDT",
    tags: ["DeFi", "Yield Trading", "PT / YT", "Revenue", "Value Capture"],
  },
  crv: {
    slug: "crv",
    name: "Curve",
    ticker: "CRV",
    aliases: ["curve dao", "curve finance"],
    subtitle: "CRV • DeFi liquidity / ve-tokenomics asset",
    branding: { iconKey: "curve", accent: "#f3a54a" },
    projectType: "liquidity_protocol_asset",
    categories: ["DeFi", "DEX", "Liquidity", "veCRV", "Governance"],
    projectProfile: {
      category: PROJECT_CATEGORIES.DEFI,
      analysisProfile: ANALYSIS_PROFILES.PRODUCT_DEFI_ECONOMICS,
      capabilities: { hasTvl:true, hasProtocolFees:true, hasDexVolume:true, hasTokenomics:true, hasUnlocks:true, hasNarrativeNews:true, hasLiquidityData:true, hasTokenUtilityData:true, hasAdoptionData:true, hasValueCaptureData:true },
      preferredSections: ["market", "tokenomics", "financials", "liquidity_and_trading", "tvl_and_capital", "final_summary", "risks", "narrative_and_news"],
    },
    coingeckoId: "curve-dao-token",
    defillamaChain: "Curve",
    newsKeywords: ["curve finance", "curve dao", "crv token", "vecrv"],
    newsRelevance: { mode:"strict", directTerms:["curve finance", "curve dao", "crv token", "vecrv"], contextTerms:["curve tvl", "curve dex", "curve liquidity", "crv emissions", "curve fees", "curve governance", "curve pools"], competingTerms:["bitcoin", "btc", "solana", "hyperliquid", "pendle"] },
    projectNewsFeeds: [{ url:"https://news.google.com/rss/search?q=%28%22Curve+Finance%22+OR+veCRV+OR+%22CRV+token%22%29+%28liquidity+OR+emissions+OR+governance+OR+fees%29&hl=en-US&gl=US&ceid=US%3Aen", source:"Curve News", priority:1, audience:"ecosystem" }],
    newsLimit: 5,
    reportOptions: { preserveCuratedSemantics:false, heroKpis:["price", "market_cap", "fdv", "volume_24h", "tvl", "dex_volume", "emission_pressure", "governance_role"], heroKpiLimit:8 },
    marketSymbols: createMarketSymbols("CRV", { exchanges:["BINANCE", "BYBIT", "GATEIO"] }),
    bybitSymbol: "CRVUSDT",
    tags: ["DeFi", "DEX", "Liquidity", "veCRV", "Governance"],
  },
  link: {
    slug: "link",
    name: "Chainlink",
    ticker: "LINK",
    aliases: ["chainlink"],
    subtitle: "LINK • oracle / utility infrastructure asset",
    branding: { iconKey: "chainlink", accent: "#5578ff" },
    projectType: "oracle_utility_asset",
    categories: ["Oracle Network", "Data Infrastructure", "Interoperability", "Utility Token"],
    projectProfile: {
      category: PROJECT_CATEGORIES.UTILITY,
      analysisProfile: ANALYSIS_PROFILES.ORACLE_UTILITY,
      capabilities: {
        hasTokenomics: true,
        hasNarrativeNews: true,
        hasLiquidityData: true,
        hasTokenUtilityData: true,
        hasAdoptionData: true,
        hasValueCaptureData: true,
      },
      preferredSections: [
        "market",
        "tokenomics",
        "liquidity_and_trading",
        "valuation",
        "utility_and_adoption",
        "risks",
        "final_summary",
        "narrative_and_news",
      ],
    },
    coingeckoId: "chainlink",
    newsKeywords: ["chainlink", "link", "ccip", "chainlink data feeds"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["chainlink", "link token", "chainlink ccip", "chainlink data feeds"],
      contextTerms: ["chainlink integration", "chainlink adoption", "oracle network", "decentralized oracle", "ccip", "cross-chain interoperability protocol", "chainlink data infrastructure", "chainlink staking", "chainlink services"],
      competingTerms: ["bitcoin", "btc", "ethereum", "ether", "solana", "dogecoin", "doge", "pepe", "xrp"],
    },
    projectNewsFeeds: [
      { url: "https://blog.chain.link/rss/", source: "Chainlink Blog", priority: 1, audience: "official" },
    ],
    newsLimit: 5,
    reportOptions: {
      compactTokenomics: true,
      heroKpis: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply", "token_utility", "adoption", "value_capture"],
      heroKpiLimit: 9,
    },
    marketSymbols: createMarketSymbols("LINK"),
    bybitSymbol: "LINKUSDT",
    tags: ["Oracle Network", "Data Infrastructure", "Interoperability", "Utility Token"],
  },
  mnt: {
    slug: "mnt",
    name: "Mantle",
    ticker: "MNT",
    aliases: ["mnt", "mantle", "mantle network"],
    searchTerms: ["mnt", "mantle"],
    subtitle: "MNT • hybrid infrastructure / ecosystem asset",
    branding: { iconKey: "mantle", accent: "#d7ff3f" },
    projectType: "infra_ecosystem_growth_asset",
    categories: ["Hybrid Infrastructure", "Ecosystem Growth", "L2", "Capital"],
    projectProfile: {
      category: PROJECT_CATEGORIES.ECOSYSTEM_GROWTH,
      analysisProfile: ANALYSIS_PROFILES.INFRA_ECOSYSTEM_GROWTH,
      capabilities: { hasTvl:true, hasStablecoins:true, hasChainFees:true, hasDexVolume:true, hasTokenomics:true, hasNarrativeNews:true, hasLiquidityData:true, hasTokenUtilityData:true },
      preferredSections: ["market", "tokenomics", "financials", "tvl_and_capital", "stablecoins", "liquidity_and_trading", "valuation", "final_summary", "risks", "narrative_and_news"],
    },
    coingeckoId: "mantle",
    defillamaChain: "Mantle",
    stablecoinChain: "Mantle",
    newsKeywords: ["mantle network", "mnt token", "mantle ecosystem"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["mantle network", "mnt token", "mantle ecosystem", "mantle treasury"],
      contextTerms: ["mantle tvl", "mantle liquidity", "mantle upgrade", "mantle defi", "mantle partnership", "mantle stablecoin", "mantle fees", "mantle adoption"],
      competingTerms: ["bitcoin", "btc", "ethereum", "solana", "near protocol", "bnb chain", "hyperliquid"],
    },
    projectNewsFeeds: [
      { url: "https://news.google.com/rss/search?q=%28%22Mantle+Network%22+OR+%22MNT+token%22+OR+%22Mantle+ecosystem%22%29+%28TVL+OR+liquidity+OR+upgrade+OR+partnership+OR+adoption%29&hl=en-US&gl=US&ceid=US%3Aen", source: "Mantle Ecosystem News", priority: 1, audience: "ecosystem" },
    ],
    newsLimit: 5,
    reportOptions: { preserveCuratedSemantics:false, heroKpis:["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "token_utility"], heroKpiLimit:8 },
    marketSymbols: createMarketSymbols("MNT", { exchanges:["BYBIT", "GATEIO"] }),
    bybitSymbol: "MNTUSDT",
    tags: ["Hybrid Infrastructure", "Ecosystem Growth", "L2", "Capital"],
  },
  near: {
    slug: "near",
    name: "NEAR Protocol",
    ticker: "NEAR",
    aliases: ["near", "near protocol", "near-protocol", "near ecosystem"],
    searchTerms: ["near", "near protocol", "near-protocol"],
    subtitle: "NEAR • infrastructure + narrative / ecosystem growth asset",
    branding: { iconKey: "near", accent: "#7cf7c4" },
    projectType: "infra_ecosystem_growth_asset",
    categories: ["Infrastructure", "Ecosystem Growth", "Chain Abstraction", "AI Narrative"],
    projectProfile: {
      category: PROJECT_CATEGORIES.ECOSYSTEM_GROWTH,
      analysisProfile: ANALYSIS_PROFILES.INFRA_ECOSYSTEM_GROWTH,
      capabilities: { hasTvl:true, hasStablecoins:true, hasChainFees:true, hasDexVolume:true, hasTokenomics:true, hasNarrativeNews:true, hasLiquidityData:true, hasTokenUtilityData:true, hasAdoptionData:true },
      preferredSections: ["market", "tokenomics", "financials", "tvl_and_capital", "stablecoins", "liquidity_and_trading", "valuation", "utility_and_adoption", "final_summary", "risks", "narrative_and_news"],
    },
    coingeckoId: "near",
    defillamaChain: "Near",
    stablecoinChain: "Near",
    newsKeywords: ["near protocol", "near ecosystem", "near chain abstraction"],
    newsRelevance: {
      mode: "strict",
      directTerms: ["near protocol", "near ecosystem", "near foundation", "near token"],
      contextTerms: ["near chain abstraction", "near intents", "near ai", "near developers", "near adoption", "near tvl", "near upgrade", "near usage"],
      competingTerms: ["bitcoin", "btc", "ethereum", "solana", "mantle network", "bnb chain", "fetch.ai"],
    },
    projectNewsFeeds: [
      { url: "https://news.google.com/rss/search?q=%28%22NEAR+Protocol%22+OR+%22NEAR+ecosystem%22%29+%28adoption+OR+developers+OR+%22chain+abstraction%22+OR+AI+OR+usage%29&hl=en-US&gl=US&ceid=US%3Aen", source: "NEAR Ecosystem News", priority: 1, audience: "ecosystem" },
    ],
    newsLimit: 5,
    reportOptions: { preserveCuratedSemantics:false, heroKpis:["price", "market_cap", "fdv", "volume_24h", "tvl", "fees", "adoption", "stablecoins"], heroKpiLimit:8 },
    marketSymbols: createMarketSymbols("NEAR", { exchanges:["BINANCE", "BYBIT", "GATEIO"] }),
    bybitSymbol: "NEARUSDT",
    tags: ["Infrastructure", "Ecosystem Growth", "Chain Abstraction", "AI Narrative"],
  },
  sol: {
    slug: "sol",
    name: "Solana",
    ticker: "SOL",
    aliases: ["solana"],
    subtitle: "SOL • infrastructure asset",
    branding: { iconKey: "solana", accent: "#14f195" },
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
    newsRelevance: {
      mode: "strict",
      directTerms: ["solana", "sol"],
      contextTerms: ["solana ecosystem", "solana etf", "solana validator", "firedancer", "solana upgrade", "solana defi", "sol staking"],
      competingTerms: ["bitcoin", "btc", "ethereum", "ether", "eth", "xrp", "dogecoin", "doge", "uniswap", "uni"],
    },
    projectNewsFeeds: [
      { url: "https://solana.com/news/rss.xml", source: "Solana News", priority: 1, audience: "official" },
    ],
    usersSource: {
      type: "none",
      chain: "Solana",
      label: "Users provider is not configured"
    },
    marketSymbols: createMarketSymbols("SOL"),
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
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function matchesRegisteredIdentity(project, normalized, fields) {
  return fields.some((field) => normalizeProjectInput(field) === normalized);
}

export function getRegisteredProject(input) {
  const normalized = normalizeProjectInput(input);
  if (!normalized) return null;

  const projects = Object.values(PROJECTS);
  // Resolve curated identities in deterministic priority order before runtime discovery.
  return projects.find((project) => matchesRegisteredIdentity(project, normalized, [project.slug]))
    || projects.find((project) => matchesRegisteredIdentity(project, normalized, [project.ticker]))
    || projects.find((project) => matchesRegisteredIdentity(project, normalized, [...(project.aliases || []), ...(project.searchTerms || []), project.coingeckoId]))
    || projects.find((project) => matchesRegisteredIdentity(project, normalized, [project.name]))
    || null;
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
