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
    stablecoinChain: "ethereum",
    bybitSymbol: "ETHUSDT",
    tags: ["L1", "DeFi", "Smart Contracts"]
  }
};

export function getProjectBySlug(slug) {
  return PROJECTS[slug?.toLowerCase()] || null;
}
