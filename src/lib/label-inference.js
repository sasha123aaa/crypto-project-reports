const MAX_LABELS = 5;
const MAX_RAW_LENGTH = 72;

const NOISE = /(?:portfolio|index|alleged sec securities|centralized exchange token|made in|year of the|tokenized stock|wormhole bridged|bridged|wrapped|rebase|yield aggregator token|crypto-backed tokens?)/i;

const LABEL_RULES = [
  [/\bdecentralized exchange(?: \(dex\))?\b|\bdex\b/i, "DEX", 100],
  [/\bperpetual(?:s| trading| exchange)?\b|\bperps\b/i, "Perpetuals", 98],
  [/\bsmart contract platform\b/i, "Smart Contracts", 96],
  [/\blayer[ -]?1\b|\bl1\b/i, "L1", 100],
  [/\blayer[ -]?2\b|\bl2\b|\brollups?\b/i, "L2", 100],
  [/\bdecentralized finance\b|\bdefi\b/i, "DeFi", 94],
  [/\breal world assets?\b|\brwa\b/i, "RWA", 94],
  [/\bartificial intelligence\b|\bai agents?\b|\bai & big data\b/i, "AI", 92],
  [/\bliquid staking derivatives?\b|\bliquid staking tokens?\b/i, "Liquid Staking", 93],
  [/\bliquid restaking\b|\brestaking\b/i, "Restaking", 92],
  [/\bmeme(?: token| coin)?s?\b/i, "Meme", 100],
  [/\bdog-themed(?: coins?)?\b/i, "Dog-Themed", 96],
  [/\bfrog-themed(?: coins?)?\b/i, "Frog-Themed", 96],
  [/\bcat-themed(?: coins?)?\b/i, "Cat-Themed", 96],
  [/\boracle(?:s| network)?\b/i, "Oracle", 99],
  [/\bdata infrastructure\b|\bdata availability\b/i, "Data Infrastructure", 92],
  [/\binteroperability\b|\bcross-chain\b/i, "Interoperability", 88],
  [/\bproof of work\b|\bpow\b/i, "Proof of Work", 91],
  [/\bproof of stake\b|\bpos\b/i, "Proof of Stake", 87],
  [/\bstore of value\b/i, "Store of Value", 94],
  [/\bpayments?\b/i, "Payments", 86],
  [/\blending(?:\/borrowing)?\b|\bborrowing\b/i, "Lending", 91],
  [/\byield trading\b/i, "Yield Trading", 93],
  [/\byield farming\b|\byield\b/i, "Yield", 82],
  [/\bderivatives?\b/i, "Derivatives", 88],
  [/\bstaking\b/i, "Staking", 82],
  [/\bgaming\b|\bplay to earn\b/i, "Gaming", 92],
  [/\bsocialfi\b|\bsocial token\b/i, "Social", 89],
  [/\bnft\b|\bnon-fungible tokens?\b/i, "NFT", 86],
  [/\bprivacy\b/i, "Privacy", 90],
  [/\bstorage\b/i, "Storage", 89],
  [/\bidentity\b/i, "Identity", 88],
  [/\bgovernance\b|\bdao\b/i, "Governance", 84],
  [/\bexchange-based tokens?\b|\bcex utility\b/i, "CEX Utility", 91],
  [/\brevenue\b|\bfee sharing\b/i, "Revenue", 86],
  [/\bburn(?:ing)?\b/i, "Burn", 80],
  [/\binfrastructure\b/i, "Infrastructure Token", 77],
  [/\butility(?: token)?\b/i, "Utility Token", 76],
  [/\btrading\b/i, "Trading Token", 74],
];

function cleanText(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/&amp;/gi, "&").replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return value.toLowerCase().replace(/(^|[\s-])([a-z0-9])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`);
}

function normalizeEcosystem(value) {
  const match = cleanText(value).match(/^(.+?)\s+ecosystem$/i);
  if (!match || match[1].length > 24) return null;
  const name = titleCase(match[1]).replace(/\bBnb\b/g, "BNB").replace(/\bDao\b/g, "DAO");
  return `${name} Ecosystem`;
}

export function normalizeRuntimeLabel(value) {
  const raw = cleanText(value);
  if (!raw || raw.length > MAX_RAW_LENGTH || NOISE.test(raw)) return null;
  const ecosystem = normalizeEcosystem(raw);
  if (ecosystem) return ecosystem;
  const rule = LABEL_RULES.find(([pattern]) => pattern.test(raw));
  return rule ? rule[1] : null;
}

function addCandidate(candidates, raw, sourceBoost = 0) {
  const label = normalizeRuntimeLabel(raw);
  if (!label) return;
  const base = LABEL_RULES.find(([, normalized]) => normalized === label)?.[2] ?? (label.endsWith(" Ecosystem") ? 70 : 60);
  const score = base + sourceBoost;
  const current = candidates.get(label.toLowerCase());
  if (!current || score > current.score) candidates.set(label.toLowerCase(), { label, score });
}

function stringValues(value) {
  if (Array.isArray(value)) return value.flatMap(stringValues);
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.keys(value);
  return [];
}

function descriptionSignals(description) {
  const text = cleanText(typeof description === "string" ? description : description?.en).slice(0, 1600);
  if (!text) return [];
  return LABEL_RULES.filter(([pattern]) => pattern.test(text)).map(([, label]) => label);
}

function fallbackLabels(category, signals = {}) {
  if (signals.isMeme || category === "meme") return ["Meme"];
  if (signals.isDefi || category === "defi") return ["DeFi Token"];
  if (signals.isInfra || signals.hasChainData || category === "infra") return ["Infrastructure Token"];
  if (signals.hasDexVolume) return ["Trading Token"];
  if (signals.hasUtilitySignals) return ["Utility Token"];
  return [];
}

export function inferRuntimeLabels({ coinDetails = {}, protocol = null, chain = null, category, signals = {}, maxLabels = MAX_LABELS } = {}) {
  const candidates = new Map();
  stringValues(coinDetails.categories).forEach((value) => addCandidate(candidates, value, 12));
  stringValues(coinDetails.tags).forEach((value) => addCandidate(candidates, value, 8));
  [protocol?.category, protocol?.type, chain?.category, chain?.type].filter(Boolean).forEach((value) => addCandidate(candidates, value, 10));
  descriptionSignals(coinDetails.description).forEach((value) => addCandidate(candidates, value, -12));

  const explicitEcosystems = stringValues(coinDetails.categories).filter((value) => /\becosystem$/i.test(value));
  if (!explicitEcosystems.length) {
    stringValues(coinDetails.platforms).slice(0, 2).forEach((platform) => addCandidate(candidates, `${platform} Ecosystem`, -10));
    if (coinDetails.asset_platform_id) addCandidate(candidates, `${coinDetails.asset_platform_id} Ecosystem`, -10);
  }
  if (chain?.name && signals.hasChainData && !signals.isMeme) addCandidate(candidates, signals.isInfra ? "L1" : `${chain.name} Ecosystem`, -8);
  if (signals.hasProtocolFees || protocol?.revenue24h) addCandidate(candidates, "Revenue", 0);

  const labels = [...candidates.values()].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).map(({ label }) => label);
  return (labels.length ? labels : fallbackLabels(category, signals)).slice(0, Math.max(1, Math.min(MAX_LABELS, maxLabels)));
}
