import { getNewsFeeds } from "../config/projects.js";

const BASE_URL="https://api.coingecko.com/api/v3";
const HEADERS={accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"};
async function fetchJsonWithTimeout(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers:HEADERS, signal:controller.signal });
    return { ok:response.ok, status:response.status, data:await response.json().catch(() => null) };
  } finally { clearTimeout(timeout); }
}
function normalizeCoinDetailsMarket(data) {
  const marketData = data?.market_data;
  if (!marketData || typeof marketData !== "object") return null;
  return { id:data?.id, symbol:data?.symbol, name:data?.name, current_price:marketData.current_price?.usd, market_cap:marketData.market_cap?.usd, fully_diluted_valuation:marketData.fully_diluted_valuation?.usd, total_volume:marketData.total_volume?.usd, circulating_supply:marketData.circulating_supply, total_supply:marketData.total_supply, max_supply:marketData.max_supply, image:data?.image?.large || data?.image?.small || data?.image?.thumb || null };
}
export async function fetchCoinGeckoMarket(coingeckoId) {
  const marketUrl = `${BASE_URL}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}&price_change_percentage=7d`;
  const detailsUrl = `${BASE_URL}/coins/${encodeURIComponent(coingeckoId)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`;
  let lastError = null;
  try {
    const primary = await fetchJsonWithTimeout(marketUrl, 9000);
    if (primary.ok && Array.isArray(primary.data) && primary.data[0]) return primary.data[0];
    lastError = new Error(`CoinGecko market error: ${primary.status}`);
  } catch (error) { lastError = error; }
  try {
    const fallback = await fetchJsonWithTimeout(detailsUrl, 9000);
    if (!fallback.ok) throw new Error(`CoinGecko market fallback error: ${fallback.status}`);
    const normalized = normalizeCoinDetailsMarket(fallback.data);
    if (!normalized) throw new Error("CoinGecko market fallback returned incomplete data");
    return normalized;
  } catch (error) { throw lastError || error; }
}

export async function fetchCoinGeckoGlobal(){
  const res=await fetch(`${BASE_URL}/global`,{headers:HEADERS});
  if(!res.ok) throw new Error(`CoinGecko global error: ${res.status}`);
  return res.json();
}

export async function fetchCoinGeckoChart(coingeckoId,days=365){
  const url=`${BASE_URL}/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res=await fetch(url,{headers:HEADERS});
  if(!res.ok) throw new Error(`CoinGecko chart error: ${res.status}`);
  return res.json();
}

export async function fetchProjectNews(project, { limit = 5, days = 45 } = {}) {
  const feeds = getNewsFeeds(project)
    .map((feed, index) => ({
      ...feed,
      layer: feed.layer || "project",
      priority: Number.isFinite(feed?.priority) ? feed.priority : index + 1,
    }))
    .sort((a, b) => a.priority - b.priority);
  const updated_at = new Date().toISOString();
  if (!feeds.length) return unavailableNews("News feeds are not configured", updated_at, []);

  const settled = await Promise.allSettled(feeds.map(fetchNewsFeed));
  const debug = settled.map((result, index) => ({
    source: feeds[index]?.source || `News source ${index + 1}`,
    layer: feeds[index]?.layer || "project",
    ok: result.status === "fulfilled",
    status: result.status === "fulfilled" ? "ok" : "failed",
    item_count: result.status === "fulfilled" ? result.value.length : 0,
    ...(result.status === "rejected" ? { error: errorMessage(result.reason) } : {}),
  }));
  debug.filter((entry) => !entry.ok).forEach((entry) => console.debug(`[news] ${entry.source} failed: ${entry.error}`));

  const cutoff = Date.now() - days * 86400000;
  const excludedSources = new Set((project?.excludedNewsSources || []).map((source) => String(source).toLowerCase()));
  const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item) => {
      const timestamp = Date.parse(item.date);
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= Date.now() + 86400000;
    })
    .filter((item) => !excludedSources.has(String(item.source || "").toLowerCase()))
    .filter((item) => isProjectRelevantNews(item, feeds, project));
  const items = selectDiverseNews(deduplicateNews(candidates), feeds, limit, project);
  const successfulSources = debug.filter((entry) => entry.ok).map((entry) => entry.source);
  const source_summary = successfulSources.length
    ? (items.length ? `${successfulSources.join(", ")} · релевантных материалов: ${items.length}` : `Проверены ${successfulSources.join(", ")}; свежих материалов с достаточной релевантностью проекту не найдено`)
    : "Настроенные источники новостей временно недоступны";

  return {
    status: items.length ? "live" : (successfulSources.length ? "partial" : "unavailable"),
    items,
    source: successfulSources.join(", ") || "Configured news feeds",
    source_summary,
    updated_at,
    debug: { sources: debug },
  };
}

export function selectDiverseNews(items, feeds = [], limit = 5, project = {}) {
  const feedMeta = new Map(feeds.map((feed, index) => [feed.source, {
    priority: Number.isFinite(feed.priority) ? feed.priority : index + 1,
    audience: feed.audience || (/research/i.test(feed.source || "") ? "research" : "client"),
    layer: feed.layer || "project",
  }]));
  const keywords = projectNewsKeywords(project);
  const excludedSources = new Set((project?.excludedNewsSources || []).map((source) => String(source).toLowerCase()));
  const eligibleItems = items.filter((item) => !excludedSources.has(String(item.source || "").toLowerCase()))
    .filter((item) => isProjectRelevantNews(item, feeds, project));
  const ranked = [...eligibleItems].sort((a, b) => newsRank(b, feedMeta, keywords) - newsRank(a, feedMeta, keywords) || byNewest(a, b));
  const selected = [];
  const nonResearchExists = ranked.some((item) => metaFor(item, feedMeta).audience !== "research");
  const researchLimit = nonResearchExists ? 1 : limit;

  const eligibleByResearch = (item) => metaFor(item, feedMeta).audience !== "research"
    || selected.filter((entry) => metaFor(entry, feedMeta).audience === "research").length < researchLimit;
  const canSelect = (item) => {
    if (selected.includes(item) || !eligibleByResearch(item)) return false;
    const lastTwo = selected.slice(-2);
    if (lastTwo.length < 2 || !lastTwo.every((entry) => entry.source === item.source)) return true;
    return !ranked.some((candidate) => !selected.includes(candidate) && candidate.source !== item.source && eligibleByResearch(candidate));
  };
  const takeUniqueSources = (pool, target) => {
    const used = new Set(selected.map((item) => item.source));
    for (const item of pool) {
      if (selected.length >= limit || target <= 0) break;
      if (used.has(item.source) || !canSelect(item)) continue;
      selected.push(item); used.add(item.source); target -= 1;
    }
  };

  const projectClient = ranked.filter((item) => metaFor(item, feedMeta).layer === "project" && metaFor(item, feedMeta).audience !== "research");
  const universal = ranked.filter((item) => metaFor(item, feedMeta).layer === "universal");
  const projectTarget = universal.length ? Math.ceil(limit * 0.6) : limit;
  const universalTarget = projectClient.length ? Math.max(1, limit - projectTarget) : limit;

  // Prefer project updates, then deliberately reserve space for the universal market layer.
  takeUniqueSources(projectClient, projectTarget);
  takeUniqueSources(universal, universalTarget);
  // Research is useful context, but it is kept to one item while client-facing news exists.
  takeUniqueSources(ranked.filter((item) => metaFor(item, feedMeta).audience === "research"), 1);

  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (canSelect(item)) selected.push(item);
  }
  const relevanceLimit = project?.newsRelevance?.mode === "strict" ? Math.min(limit, project?.newsLimit || 3) : limit;
  return selected.slice(0, relevanceLimit);
}

export function projectNewsRelevanceScore(item, feeds = [], project = {}) {
  const relevance = project?.newsRelevance || {};
  if (relevance.mode !== "strict") return 100;

  const feed = feeds.find((candidate) => candidate.source === item.source);
  const layer = feed?.layer || "project";
  const title = normalizedField(item.title);
  const url = normalizedField(item.url);
  const snippet = normalizedField(item.snippet);
  const source = normalizedField(item.source);
  const directTerms = normalizedTerms(relevance.directTerms || projectNewsKeywords(project));
  const contextTerms = normalizedTerms(relevance.contextTerms || []);
  const competingTerms = normalizedTerms(relevance.competingTerms || []);
  const directInTitle = countTerms(title, directTerms);
  const contextInTitle = countTerms(title, contextTerms);
  const directInUrl = countTerms(url, directTerms);
  const contextInUrl = countTerms(url, contextTerms);
  const directInSnippet = countTerms(snippet, directTerms);
  const contextInSnippet = countTerms(snippet, contextTerms);
  const projectInSource = layer === "project" ? countTerms(source, [...directTerms, ...contextTerms]) : 0;
  const competingInTitle = countTerms(title, competingTerms);

  // Title is deliberately dominant. A snippet-only side mention cannot qualify a
  // universal market story, while a clearly project-owned feed gets provenance credit.
  return directInTitle * 12
    + contextInTitle * 14
    + directInUrl * 6
    + contextInUrl * 8
    + Math.min(directInSnippet, 2) * 2
    + Math.min(contextInSnippet, 2) * 3
    + (layer === "project" ? 7 : 0)
    + projectInSource * 2
    - competingInTitle * 7;
}

export function isProjectRelevantNews(item, feeds = [], project = {}) {
  if (project?.newsRelevance?.mode !== "strict") return true;
  const feed = feeds.find((candidate) => candidate.source === item.source);
  const layer = feed?.layer || "project";
  const score = projectNewsRelevanceScore(item, feeds, project);
  const title = normalizedField(item.title);
  const url = normalizedField(item.url);
  const relevance = project.newsRelevance;
  const focusTerms = normalizedTerms([...(relevance.directTerms || []), ...(relevance.contextTerms || [])]);
  const hasHeadlineOrSlugFocus = countTerms(`${title} ${url}`, focusTerms) > 0;

  // Universal publishers must demonstrate focus in the headline or URL. Project-owned
  // sources may qualify by provenance, but still pass through the same score function.
  if (layer === "universal" && !hasHeadlineOrSlugFocus) return false;
  return score >= (layer === "universal" ? 10 : 7);
}

function normalizedTerms(terms) {
  return [...new Set(terms.map((term) => normalizeTitle(term)).filter(Boolean))];
}

function normalizedField(value) {
  return ` ${normalizeTitle(value || "")} `;
}

function countTerms(text, terms) {
  return terms.filter((term) => text.includes(` ${term} `)).length;
}

function metaFor(item, feedMeta) {
  return feedMeta.get(item.source) || { priority: 99, audience: "client", layer: "universal" };
}

function newsRank(item, feedMeta, keywords) {
  const meta = metaFor(item, feedMeta);
  const ageDays = Math.max(0, (Date.now() - Date.parse(item.date)) / 86400000);
  const freshness = Math.max(0, 45 - ageDays) * 4;
  const clientRelevance = meta.audience === "research" ? 0 : 120;
  const projectLayer = meta.layer === "project" ? 160 : 0;
  const topicRelevance = meta.layer === "universal" ? topicMatchCount(item, keywords) * 45 : 0;
  return freshness + clientRelevance + projectLayer + topicRelevance - meta.priority * 8 + Math.min(String(item.snippet || "").length, 160) / 8;
}

function projectNewsKeywords(project) {
  return [...new Set([
    ...(Array.isArray(project?.newsKeywords) ? project.newsKeywords : []),
    project?.name,
    project?.ticker,
    project?.slug,
  ].filter(Boolean).map((value) => normalizeTitle(value)).filter(Boolean))];
}

function topicMatchCount(item, keywords) {
  if (!keywords.length) return 0;
  const text = ` ${normalizeTitle(`${item.title || ""} ${item.snippet || ""}`)} `;
  return keywords.filter((keyword) => text.includes(` ${keyword} `)).length;
}

export async function fetchNewsFeed(feed) {
  const res = await fetch(feed.url, { headers: { accept: "application/rss+xml,application/atom+xml,text/xml,*/*", "cache-control":"no-cache", "user-agent": HEADERS["user-agent"] } });
  if (!res.ok) throw new Error(`${feed.source || "RSS"} news error: ${res.status}`);
  const xml = await res.text();
  if (!xml.trim()) throw new Error(`${feed.source || "RSS"} returned an empty feed`);
  return [...xml.matchAll(/<(?:[\w-]+:)?(item|entry)\b[\s\S]*?<\/(?:[\w-]+:)?\1>/gi)]
    .map((match) => parseFeedItem(match[0], feed.source || "Official feed"))
    .filter(Boolean);
}

export function parseFeedItem(xml, source) {
  const title = cleanXml(readTag(xml, "title"));
  const rawDate = cleanXml(readTag(xml, "pubDate") || readTag(xml, "published") || readTag(xml, "updated") || readTag(xml, "date"));
  const timestamp = Date.parse(rawDate);
  const url = cleanXml(readTag(xml, "link")) || cleanXml(xml.match(/<link\b[^>]*\bhref=["']([^"']+)/i)?.[1]) || cleanXml(readTag(xml, "guid"));
  const snippet = cleanXml(readTag(xml, "description") || readTag(xml, "summary") || readTag(xml, "content:encoded") || readTag(xml, "content")).slice(0, 220);
  if (!title || !Number.isFinite(timestamp) || !url) return null;
  return { title, url, date: new Date(timestamp).toISOString(), source, snippet };
}

export function deduplicateNews(items) {
  const selected = [];
  for (const item of [...items].sort(byQuality)) {
    const duplicate = selected.some((existing) => isDuplicateNews(existing, item));
    if (!duplicate) selected.push(item);
  }
  return selected;
}

function isDuplicateNews(a, b) {
  if (normalizeUrl(a.url) && normalizeUrl(a.url) === normalizeUrl(b.url)) return true;
  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);
  if (titleA === titleB) return true;
  const closeDates = Math.abs(Date.parse(a.date) - Date.parse(b.date)) <= 3 * 86400000;
  return closeDates && titleSimilarity(titleA, titleB) >= 0.82;
}
function titleSimilarity(a, b) {
  const left = new Set(a.split(" ").filter(Boolean));
  const right = new Set(b.split(" ").filter(Boolean));
  if (!left.size || !right.size) return 0;
  const common = [...left].filter((word) => right.has(word)).length;
  return common / Math.max(left.size, right.size);
}
function byQuality(a, b) { return qualityScore(b) - qualityScore(a) || byNewest(a, b); }
function qualityScore(item) { return Math.min(String(item.title || "").length, 120) + (item.snippet ? 80 : 0) + (Number.isFinite(Date.parse(item.date)) ? 40 : 0); }
function byNewest(a, b) { return Date.parse(b.date) - Date.parse(a.date); }
function normalizeTitle(value) { return cleanXml(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim(); }
function normalizeUrl(value) { try { const url = new URL(value); url.hash = ""; ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach((key) => url.searchParams.delete(key)); return url.toString().replace(/\/$/, ""); } catch { return String(value || "").replace(/\/$/, ""); } }
function unavailableNews(error, updated_at, sources) { return { status:"unavailable", items:[], source:"Configured news feeds", source_summary:"Настроенные источники новостей временно недоступны", updated_at, debug:{ sources, error } }; }
function errorMessage(error) { return error instanceof Error ? error.message : String(error || "Unknown error"); }
function readTag(xml, tag) { const escaped = tag.replace(":", "\\:"); return xml.match(new RegExp(`<(?:[\\w-]+:)?${escaped}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escaped}>`, "i"))?.[1] || ""; }
function cleanXml(value) { return decodeEntities(String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function decodeEntities(value) { return value.replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " "); }

export async function searchCoinGeckoProjects(input) {
  const url = `${BASE_URL}/search?query=${encodeURIComponent(input)}`;
  const res = await fetch(url, { headers:HEADERS });
  if (!res.ok) throw new Error(`CoinGecko search error: ${res.status}`);
  const payload = await res.json();
  return Array.isArray(payload?.coins) ? payload.coins : [];
}

export async function fetchCoinGeckoProject(coingeckoId) {
  const params = "localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false";
  const url = `${BASE_URL}/coins/${encodeURIComponent(coingeckoId)}?${params}`;
  const res = await fetch(url, { headers:HEADERS });
  if (!res.ok) throw new Error(`CoinGecko project error: ${res.status}`);
  return res.json();
}
