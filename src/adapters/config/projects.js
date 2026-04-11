export const PROJECTS = {
  eth: { slug: "eth", name: "Ethereum", ticker: "ETH", subtitle: "ETH • infrastructure asset", projectType: "l1", categories: ["L1","DeFi","Smart Contracts"], coingeckoId: "ethereum", defillamaChain: "Ethereum", stablecoinChain: "ethereum", bybitSymbol: "ETHUSDT", tags: ["L1","DeFi","Smart Contracts"] },
  sol: { slug: "sol", name: "Solana", ticker: "SOL", subtitle: "SOL • high-performance infrastructure asset", projectType: "l1", categories: ["L1","DeFi","Infra"], coingeckoId: "solana", defillamaChain: "Solana", stablecoinChain: "solana", bybitSymbol: "SOLUSDT", tags: ["L1","DeFi","Infra"] },
  link: { slug: "link", name: "Chainlink", ticker: "LINK", subtitle: "LINK • oracle infrastructure asset", projectType: "infra", categories: ["Oracle","Infra","Data"], coingeckoId: "chainlink", defillamaChain: null, stablecoinChain: null, bybitSymbol: "LINKUSDT", tags: ["Oracle","Infra","Data"] },
};
export function getProjectBySlug(slug) { return PROJECTS[slug?.toLowerCase()] || null; }
