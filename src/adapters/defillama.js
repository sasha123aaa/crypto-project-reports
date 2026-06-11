const JSON_HEADERS = { accept: "application/json,text/plain,*/*", "user-agent": "Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0" };

export async function fetchDefiLlamaChains(){ const res=await fetch("https://api.llama.fi/v2/chains"); if(!res.ok) throw new Error(`DefiLlama chains error: ${res.status}`); return res.json(); }
export async function fetchDefiLlamaProtocols(){ const res=await fetch("https://api.llama.fi/protocols"); if(!res.ok) throw new Error(`DefiLlama protocols error: ${res.status}`); return res.json(); }
export async function fetchDefiLlamaTVLHistory(chainName){ const res=await fetch(`https://api.llama.fi/charts/${encodeURIComponent(chainName)}`); if(!res.ok) throw new Error(`DefiLlama TVL history error: ${res.status}`); return res.json(); }
export async function fetchStablecoinHistory(chainKey){ const res=await fetch(`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chainKey)}`, { headers:JSON_HEADERS }); if(!res.ok) throw new Error(`DefiLlama stable history error: ${res.status}`); return res.json(); }

export function stablecoinMcapUsd(row) {
  const usdBuckets = row?.totalCirculatingUSD;
  if (usdBuckets && typeof usdBuckets === "object" && !Array.isArray(usdBuckets)) {
    // DefiLlama's chain chart stores every peg bucket already converted to USD;
    // summing them matches the full Stablecoins Mcap shown on the chain page.
    const values = Object.values(usdBuckets).map(toFiniteNumber).filter(Number.isFinite);
    if (values.length) return values.reduce((total, value) => total + value, 0);
  }
  const direct = toFiniteNumber(usdBuckets);
  if (Number.isFinite(direct)) return direct;
  return toFiniteNumber(row?.totalCirculating?.peggedUSD ?? row?.totalCirculating?.usd ?? row?.totalLiquidityUSD);
}

export function normalizeStablecoinHistory(payload) {
  const rows = Array.isArray(payload) ? payload : (payload?.chart ?? payload?.data ?? payload?.history ?? []);
  const byDate = new Map();
  rows.forEach((row) => {
    const rawDate = toFiniteNumber(row?.date ?? row?.timestamp ?? row?.time);
    const value = stablecoinMcapUsd(row);
    if (!Number.isFinite(rawDate) || !Number.isFinite(value) || value <= 0) return;
    const date = rawDate < 1e12 ? Math.trunc(rawDate) : Math.trunc(rawDate / 1000);
    byDate.set(date, { ...row, date, totalCirculatingUSD:value });
  });
  return Array.from(byDate.values()).sort((a, b) => a.date - b.date);
}
export async function fetchStablecoinChains(){ const res=await fetch("https://stablecoins.llama.fi/stablecoinchains"); if(!res.ok) throw new Error(`DefiLlama stable chains error: ${res.status}`); return res.json(); }
export async function fetchAppFeesOverview(chainName){ const url=`https://api.llama.fi/overview/fees/${encodeURIComponent(chainName)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees`; const res=await fetch(url); if(!res.ok) throw new Error(`DefiLlama app fees error: ${res.status}`); return res.json(); }
export async function fetchChainFeesOverview(chainName){ const url=`https://api.llama.fi/summary/fees/${encodeURIComponent(String(chainName).toLowerCase())}?dataType=dailyFees&excludeTotalDataChart=false`; const res=await fetch(url); if(!res.ok) throw new Error(`DefiLlama chain fees error: ${res.status}`); return res.json(); }
export const fetchFeesOverview = fetchAppFeesOverview;
export async function fetchDexOverview(chainName){ const url=`https://api.llama.fi/overview/dexs/${encodeURIComponent(chainName)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`; const res=await fetch(url); if(!res.ok) throw new Error(`DefiLlama dex error: ${res.status}`); return res.json(); }

export async function fetchDefiLlamaRwaActiveMcap(chainName) {
  const attempts = [];
  const apiEndpoints = [
    "https://api.llama.fi/rwa/chains",
    "https://api.llama.fi/rwa",
  ];

  for (const endpoint of apiEndpoints) {
    const result = await tryRwaJsonEndpoint(endpoint, chainName);
    attempts.push(result.debug);
    if (Number.isFinite(result.value)) return rwaResult(result.value, endpoint, attempts);
  }

  const pageEndpoint = `https://defillama.com/rwa/chain/${encodeURIComponent(normalizeChainKey(chainName))}`;
  const pageResult = await tryRwaPageEndpoint(pageEndpoint, chainName);
  attempts.push(pageResult.debug);
  if (Number.isFinite(pageResult.value)) return rwaResult(pageResult.value, pageEndpoint, attempts);

  const reason = attempts.map((attempt) => `${attempt.endpoint}: ${attempt.reason}`).join("; ");
  const error = new Error(`DefiLlama RWA Active Mcap unavailable (${reason})`);
  error.debug = { chain: chainName, attempts };
  throw error;
}

async function tryRwaJsonEndpoint(endpoint, chainName) {
  try {
    const res = await fetch(endpoint, { headers: JSON_HEADERS });
    if (!res.ok) return { value:null, debug:{ endpoint, type:"json_api", status:res.status, reason:`HTTP ${res.status}` } };
    const payload = await res.json();
    const match = findRwaChainMatch(payload, chainName);
    return { value:match?.value ?? null, debug:{ endpoint, type:"json_api", status:res.status, reason:match ? "matched" : "chain or active market cap field not found", match:match?.debug || null, payload_shape:describePayload(payload) } };
  } catch (error) {
    return { value:null, debug:{ endpoint, type:"json_api", reason:errorMessage(error) } };
  }
}

async function tryRwaPageEndpoint(endpoint, chainName) {
  try {
    const res = await fetch(endpoint, { headers:{ ...JSON_HEADERS, accept:"text/html,application/xhtml+xml,*/*" } });
    if (!res.ok) return { value:null, debug:{ endpoint, type:"public_page", status:res.status, reason:`HTTP ${res.status}` } };
    const html = await res.text();
    const structured = findRwaValueInPageScripts(html, chainName);
    if (structured) return { value:structured.value, debug:{ endpoint, type:"public_page", status:res.status, reason:"matched structured page data", match:structured.debug } };
    const visibleValue = findVisibleRwaPageValue(html);
    return { value:visibleValue, debug:{ endpoint, type:"public_page", status:res.status, reason:Number.isFinite(visibleValue) ? "matched visible Total RWA Active Mcap" : "metric not found in structured or visible page data" } };
  } catch (error) {
    return { value:null, debug:{ endpoint, type:"public_page", reason:errorMessage(error) } };
  }
}

function rwaResult(value, endpoint, attempts) {
  return { value, source:"DefiLlama RWA", updated_at:new Date().toISOString(), debug:{ endpoint, attempts } };
}

export function findRwaChainValue(payload, chainName) {
  return findRwaChainMatch(payload, chainName)?.value ?? null;
}

function findRwaChainMatch(payload, chainName) {
  const targets = chainAliases(chainName);
  const queue = [{ value:payload, path:"root", keyedName:"" }];
  const visited = new Set();
  while (queue.length) {
    const current = queue.shift();
    const row = current.value;
    if (!row || typeof row !== "object" || visited.has(row)) continue;
    visited.add(row);
    const names = collectChainNames(row, current.keyedName);
    if (names.some((name) => targets.has(normalizeChainKey(name)))) {
      const metric = findActiveMcapField(row);
      if (metric) return { value:metric.value, debug:{ path:current.path, chain_fields:names, metric_field:metric.key } };
    }
    for (const [key, value] of Object.entries(row)) {
      if (!value || typeof value !== "object") continue;
      if (Array.isArray(value)) value.forEach((child, index) => queue.push({ value:child, path:`${current.path}.${key}.${index}`, keyedName:"" }));
      else queue.push({ value, path:`${current.path}.${key}`, keyedName:key });
    }
  }
  return null;
}

function collectChainNames(row, keyedName) {
  const identityKeys = /^(name|chain|chainname|chain_name|slug|key|displayname|display_name|id)$/i;
  const names = keyedName ? [keyedName] : [];
  for (const [key, value] of Object.entries(row)) {
    if (identityKeys.test(key) && ["string", "number"].includes(typeof value)) names.push(String(value));
  }
  return names;
}

function findActiveMcapField(row) {
  const preferredKeys = ["activeMcap","active_mcap","activeMarketcap","active_marketcap","activeMarketCap","rwaActiveMcap","totalRwaActiveMcap","totalActiveMcap","totalRwaActiveMarketcap","total_rwa_active_mcap"];
  for (const key of preferredKeys) {
    const value = toFiniteNumber(row[key]);
    if (Number.isFinite(value)) return { key, value };
  }
  for (const [key, raw] of Object.entries(row)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (normalized.includes("active") && (normalized.includes("mcap") || normalized.includes("marketcap")) && !normalized.includes("onchain")) {
      const value = toFiniteNumber(raw);
      if (Number.isFinite(value)) return { key, value };
    }
  }
  return null;
}

function findRwaValueInPageScripts(html, chainName) {
  const scripts = [...String(html).matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim()).filter((text) => text.startsWith("{") || text.startsWith("["));
  for (const script of scripts) {
    try { const match = findRwaChainMatch(JSON.parse(script), chainName); if (match) return match; } catch { /* non-JSON script */ }
  }
  return null;
}

function findVisibleRwaPageValue(html) {
  const text = decodeHtml(String(html).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");
  const match = text.match(/Total\s+RWA\s+Active\s+Mcap\s*\$?([\d,.]+)\s*([kmbt])?/i);
  if (!match) return null;
  const base = Number(match[1].replace(/,/g, ""));
  const multipliers = { k:1e3, m:1e6, b:1e9, t:1e12 };
  return Number.isFinite(base) ? base * (multipliers[String(match[2] || "").toLowerCase()] || 1) : null;
}

function chainAliases(chainName) {
  const normalized = normalizeChainKey(chainName);
  return new Set([normalized, normalized.replace(/mainnet$/, "")].filter(Boolean));
}
function normalizeChainKey(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
function toFiniteNumber(value) { const number = typeof value === "string" ? Number(value.replace(/[$,]/g, "")) : Number(value); return Number.isFinite(number) ? number : null; }
function describePayload(payload) { return Array.isArray(payload) ? `array(${payload.length})` : (payload && typeof payload === "object" ? `object(${Object.keys(payload).slice(0, 12).join(",")})` : typeof payload); }
function decodeHtml(value) { return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'"); }
function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
