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
  const feeds = Array.isArray(project?.newsFeeds) ? project.newsFeeds : [];
  if (!feeds.length) throw new Error("News feeds are not configured");
  const settled = await Promise.allSettled(feeds.map(fetchNewsFeed));
  const cutoff = Date.now() - days * 86400000;
  const seen = new Set();
  const items = settled.flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item) => Number.isFinite(Date.parse(item.date)) && Date.parse(item.date) >= cutoff)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    .filter((item) => {
      const key = `${item.url || ""}|${item.title.toLowerCase().replace(/\s+/g, " ")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
  if (!items.length && settled.every((result) => result.status === "rejected")) throw new Error("All news feeds are unavailable");
  return { items, source: feeds.map((feed) => feed.source).filter(Boolean).join(", "), updated_at: new Date().toISOString() };
}

async function fetchNewsFeed(feed) {
  const res = await fetch(feed.url, { headers: { accept: "application/rss+xml,application/atom+xml,text/xml,*/*", "user-agent": HEADERS["user-agent"] } });
  if (!res.ok) throw new Error(`${feed.source || "RSS"} news error: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)].map((match) => parseFeedItem(match[0], feed.source || "Official feed")).filter(Boolean);
}

function parseFeedItem(xml, source) {
  const title = cleanXml(readTag(xml, "title"));
  const date = cleanXml(readTag(xml, "pubDate") || readTag(xml, "published") || readTag(xml, "updated"));
  const url = cleanXml(readTag(xml, "link")) || cleanXml(xml.match(/<link[^>]+href=["']([^"']+)/i)?.[1]);
  const snippet = cleanXml(readTag(xml, "description") || readTag(xml, "summary") || readTag(xml, "content")).slice(0, 220);
  if (!title || !date || !url) return null;
  return { date: new Date(date).toISOString(), title, source, url, snippet };
}
function readTag(xml, tag) { return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || ""; }
function cleanXml(value) { return String(value || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); }
