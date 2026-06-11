const BASE_URL="https://api.coingecko.com/api/v3";
const HEADERS={accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"};
export async function fetchCoinGeckoMarket(coingeckoId){
  const url=`${BASE_URL}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}&price_change_percentage=7d`;
  const res=await fetch(url,{headers:HEADERS});
  if(!res.ok) throw new Error(`CoinGecko market error: ${res.status}`);
  const data=await res.json(); return data?.[0]||null;
}
export async function fetchCoinGeckoChart(coingeckoId,days=365){
  const url=`${BASE_URL}/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res=await fetch(url,{headers:HEADERS});
  if(!res.ok) throw new Error(`CoinGecko chart error: ${res.status}`);
  return res.json();
}

export async function fetchProjectNews(project, { limit = 5, days = 30 } = {}) {
  const feeds = (Array.isArray(project?.newsFeeds) ? project.newsFeeds : [])
    .map((feed, index) => ({ ...feed, priority: Number.isFinite(feed?.priority) ? feed.priority : index + 1 }))
    .sort((a, b) => a.priority - b.priority);
  const updated_at = new Date().toISOString();
  if (!feeds.length) return unavailableNews("News feeds are not configured", updated_at, []);

  const settled = await Promise.allSettled(feeds.map(fetchNewsFeed));
  const debug = settled.map((result, index) => ({
    source: feeds[index]?.source || `News source ${index + 1}`,
    ok: result.status === "fulfilled",
    status: result.status === "fulfilled" ? "ok" : "failed",
    item_count: result.status === "fulfilled" ? result.value.length : 0,
    ...(result.status === "rejected" ? { error: errorMessage(result.reason) } : {}),
  }));
  debug.filter((entry) => !entry.ok).forEach((entry) => console.debug(`[news] ${entry.source} failed: ${entry.error}`));

  const cutoff = Date.now() - days * 86400000;
  const candidates = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item) => {
      const timestamp = Date.parse(item.date);
      return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= Date.now() + 86400000;
    });
  const items = selectDiverseNews(deduplicateNews(candidates), feeds, limit);
  const successfulSources = debug.filter((entry) => entry.ok).map((entry) => entry.source);
  const source_summary = successfulSources.length
    ? `${successfulSources.join(", ")} · ${items.length} news items from the last ${days} days`
    : "All configured news sources are temporarily unavailable";

  return {
    status: items.length ? "live" : (successfulSources.length ? "partial" : "unavailable"),
    items,
    source: successfulSources.join(", ") || "Configured news feeds",
    source_summary,
    updated_at,
    debug: { sources: debug },
  };
}

export function selectDiverseNews(items, feeds = [], limit = 5) {
  const priorities = new Map(feeds.map((feed, index) => [feed.source, Number.isFinite(feed.priority) ? feed.priority : index + 1]));
  const remaining = [...items].sort((a, b) => (priorities.get(a.source) || 99) - (priorities.get(b.source) || 99) || byNewest(a, b));
  const selected = [];
  const sourceCounts = new Map();

  while (selected.length < limit && remaining.length) {
    const lastSource = selected.at(-1)?.source;
    const previousSource = selected.at(-2)?.source;
    const unseenSources = [...new Set(remaining.filter((item) => item.source !== lastSource && (sourceCounts.get(item.source) || 0) === 0).map((item) => item.source))]
      .sort((a, b) => remaining.filter((item) => item.source === b).length - remaining.filter((item) => item.source === a).length || (priorities.get(a) || 99) - (priorities.get(b) || 99));
    const diverseIndex = unseenSources.length ? remaining.findIndex((item) => item.source === unseenSources[0]) : -1;
    const nonRepeatIndex = remaining.findIndex((item) => !(item.source === lastSource && item.source === previousSource));
    const index = diverseIndex >= 0 ? diverseIndex : (nonRepeatIndex >= 0 ? nonRepeatIndex : 0);
    const [item] = remaining.splice(index, 1);
    selected.push(item);
    sourceCounts.set(item.source, (sourceCounts.get(item.source) || 0) + 1);
  }
  return selected;
}

export async function fetchNewsFeed(feed) {
  const res = await fetch(feed.url, { headers: { accept: "application/rss+xml,application/atom+xml,text/xml,*/*", "user-agent": HEADERS["user-agent"] } });
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
function unavailableNews(error, updated_at, sources) { return { status:"unavailable", items:[], source:"Configured news feeds", source_summary:"All configured news sources are temporarily unavailable", updated_at, debug:{ sources, error } }; }
function errorMessage(error) { return error instanceof Error ? error.message : String(error || "Unknown error"); }
function readTag(xml, tag) { const escaped = tag.replace(":", "\\:"); return xml.match(new RegExp(`<(?:[\\w-]+:)?${escaped}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${escaped}>`, "i"))?.[1] || ""; }
function cleanXml(value) { return decodeEntities(String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim(); }
function decodeEntities(value) { return value.replace(/&#(x?[0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code.replace(/^x/i, ""), /^x/i.test(code) ? 16 : 10))).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&apos;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " "); }
