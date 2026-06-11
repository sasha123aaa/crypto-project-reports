import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateNews, fetchProjectNews, parseFeedItem } from "../src/adapters/coingecko.js";

const now = new Date();
const recent = new Date(now.getTime() - 2 * 86400000).toUTCString();

test("parseFeedItem supports Atom links, updated dates, and HTML snippets", () => {
  const item = parseFeedItem(`<entry><title>Ethereum update</title><link href="https://example.com/update"/><updated>${now.toISOString()}</updated><content:encoded><![CDATA[<p>Useful <strong>summary</strong></p>]]></content:encoded></entry>`, "Official");
  assert.deepEqual(item, { title:"Ethereum update", url:"https://example.com/update", date:now.toISOString(), source:"Official", snippet:"Useful summary" });
});

test("deduplicateNews keeps the higher-quality near-identical item", () => {
  const items = deduplicateNews([
    { title:"Ethereum protocol update announced", url:"https://a.test/one", date:now.toISOString(), source:"A", snippet:"" },
    { title:"Ethereum: protocol update announced", url:"https://b.test/two", date:now.toISOString(), source:"B", snippet:"Detailed summary" },
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].source, "B");
});

test("fetchProjectNews continues after one source fails and exposes debug", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url.includes("failed")) return new Response("no", { status:503 });
    return new Response(`<rss><channel><item><title>Fresh update</title><link>https://example.com/fresh</link><pubDate>${recent}</pubDate><description><![CDATA[<p>Summary</p>]]></description></item></channel></rss>`, { status:200 });
  };
  try {
    const news = await fetchProjectNews({ newsFeeds:[{url:"https://failed.test/rss",source:"Failed"},{url:"https://ok.test/rss",source:"Working"}] });
    assert.equal(news.status, "live");
    assert.equal(news.items.length, 1);
    assert.deepEqual(news.debug.sources.map(({source, status, item_count}) => ({source, status, item_count})), [
      { source:"Failed", status:"failed", item_count:0 },
      { source:"Working", status:"ok", item_count:1 },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test("fetchProjectNews returns unavailable when every source fails", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("no", { status:503 });
  try {
    const news = await fetchProjectNews({ newsFeeds:[{url:"https://failed.test/rss",source:"Failed"}] });
    assert.equal(news.status, "unavailable");
    assert.deepEqual(news.items, []);
    assert.equal(news.debug.sources[0].status, "failed");
    assert.ok(news.updated_at);
  } finally { globalThis.fetch = originalFetch; }
});
