const USERS_SOURCE_EXAMPLES = {
  custom_json: {
    type: "custom_json",
    endpoint: "/data/users/<project-slug>.json",
    label: "Custom users feed",
    dataset: "standard_users_v1",
  },
};

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
