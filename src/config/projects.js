const USERS_SOURCE_EXAMPLES = {
  custom_json: {
    type: "custom_json",
    endpoint: "/data/users/<project-slug>.json",
    label: "Custom users feed",
    dataset: "standard_users_v1",
  },
};

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
    coingeckoId: "ethereum",
    defillamaChain: "Ethereum",
    stablecoinChain: "Ethereum",
    rwaChain: "Ethereum",
    newsKeywords: ["ethereum", "ether", "eth"],
    projectNewsFeeds: [
      { url: "https://blog.ethereum.org/feed.xml", source: "Ethereum Blog", priority: 1, audience: "official" },
      { url: "https://weekinethereumnews.com/feed/", source: "Week in Ethereum News", priority: 2, audience: "ecosystem" },
      { url: "https://medium.com/feed/ethereum-cat-herders", source: "Ethereum Cat Herders", priority: 3, audience: "ecosystem" },
      { url: "https://ethresear.ch/latest.rss", source: "Ethereum Research", priority: 4, audience: "research" },
    ],
    reportOptions: { hideExecutiveSummary: true, compactTokenomics: true, integratedFinancials: true },
    usersSource: {
      type: "none",
      chain: "Ethereum",
      label: "Users provider is not configured"
    },
    bybitSymbol: "ETHUSDT",
    tags: ["L1", "DeFi", "Smart Contracts"]
  }
};

export function getProjectBySlug(slug) {
  return PROJECTS[slug?.toLowerCase()] || null;
}

export function getUsersSourceExamples() {
  return USERS_SOURCE_EXAMPLES;
}

export function getNewsFeeds(project) {
  if (Array.isArray(project?.newsFeeds)) return project.newsFeeds;
  return [
    ...UNIVERSAL_NEWS_FEEDS,
    ...(Array.isArray(project?.projectNewsFeeds) ? project.projectNewsFeeds : []).map((feed) => ({ ...feed, layer: feed.layer || "project" })),
  ];
}
