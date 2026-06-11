import test from "node:test";
import assert from "node:assert/strict";
import { deduplicateNews, fetchProjectNews, isProjectRelevantNews, parseFeedItem, selectDiverseNews } from "../src/adapters/coingecko.js";
import { getNewsFeeds, PROJECTS } from "../src/config/projects.js";

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


test("selectDiverseNews mixes available sources before repeating one source", () => {
  const date = now.toISOString();
  const items = [
    { title:"Research 1", url:"https://r.test/1", date, source:"Ethereum Research" },
    { title:"Research 2", url:"https://r.test/2", date, source:"Ethereum Research" },
    { title:"Research 3", url:"https://r.test/3", date, source:"Ethereum Research" },
    { title:"Official update", url:"https://o.test/1", date, source:"Ethereum Blog" },
    { title:"Ecosystem update", url:"https://e.test/1", date, source:"Consensys News" },
  ];
  const selected = selectDiverseNews(items, [
    { source:"Ethereum Blog", priority:1 },
    { source:"Consensys News", priority:2 },
    { source:"Ethereum Research", priority:3 },
  ], 5);
  assert.deepEqual(new Set(selected.slice(0, 3).map((item) => item.source)), new Set(["Ethereum Blog", "Consensys News", "Ethereum Research"]));
  assert.ok(selected.every((item, index) => index < 2 || !(item.source === selected[index - 1].source && item.source === selected[index - 2].source)));
});


test("selectDiverseNews prioritizes fresh client updates over academic posts", () => {
  const items = [
    { title:"Accessible ecosystem update", url:"https://blog.test/update", date:new Date(now.getTime() - 3 * 86400000).toISOString(), source:"Ethereum Blog", snippet:"Client-facing update" },
    { title:"Fresh research discussion", url:"https://research.test/update", date:new Date(now.getTime() - 86400000).toISOString(), source:"Ethereum Research", snippet:"Research discussion" },
  ];
  const selected = selectDiverseNews(items, [
    { source:"Ethereum Blog", priority:1, audience:"client" },
    { source:"Ethereum Research", priority:2, audience:"research" },
  ], 1);
  assert.equal(selected[0].source, "Ethereum Blog");
});


test("selectDiverseNews limits research to one item when client sources are available", () => {
  const date = now.toISOString();
  const items = [
    ...Array.from({ length:4 }, (_, index) => ({ title:`Research ${index}`, url:`https://r.test/${index}`, date, source:"Ethereum Research" })),
    { title:"Official", url:"https://o.test/1", date, source:"Ethereum Blog" },
    { title:"Weekly", url:"https://w.test/1", date, source:"Week in Ethereum News" },
  ];
  const selected = selectDiverseNews(items, [
    { source:"Ethereum Blog", priority:1, audience:"client" },
    { source:"Week in Ethereum News", priority:2, audience:"client" },
    { source:"Ethereum Research", priority:4, audience:"research" },
  ], 5);
  assert.equal(selected.filter((item) => item.source === "Ethereum Research").length, 1);
});

test("fetchProjectNews merges universal and project-specific feed layers", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => new Response(`<rss><channel><item><title>${url.includes("coindesk") ? "Ethereum market update" : "Official Ethereum update"}</title><link>${url}/item</link><pubDate>${recent}</pubDate><description>Fresh summary</description></item></channel></rss>`, { status:200 });
  try {
    const news = await fetchProjectNews({
      name:"Ethereum",
      ticker:"ETH",
      slug:"eth",
      projectNewsFeeds:[{ url:"https://project.test/rss", source:"Project Blog", priority:1, audience:"official" }],
    }, { limit:5 });
    assert.deepEqual(new Set(news.items.map((item) => item.source)), new Set(["Project Blog", "CoinDesk"]));
    assert.deepEqual(news.debug.sources.map(({ source, layer }) => ({ source, layer })), [
      { source:"Project Blog", layer:"project" },
      { source:"CoinDesk", layer:"universal" },
    ]);
  } finally { globalThis.fetch = originalFetch; }
});

test("fetchProjectNews can build a feed from universal sources without project feeds", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(`<rss><channel><item><title>General crypto market update</title><link>https://coindesk.test/item</link><pubDate>${recent}</pubDate><description>Fresh summary</description></item></channel></rss>`, { status:200 });
  try {
    const news = await fetchProjectNews({ name:"New Coin", ticker:"NEW", slug:"new" });
    assert.equal(news.status, "live");
    assert.equal(news.items[0].source, "CoinDesk");
    assert.equal(news.debug.sources[0].layer, "universal");
  } finally { globalThis.fetch = originalFetch; }
});

test("selectDiverseNews reserves room for universal news when project updates exist", () => {
  const date = now.toISOString();
  const selected = selectDiverseNews([
    { title:"Official one", url:"https://p.test/1", date, source:"Project Blog" },
    { title:"Official two", url:"https://p.test/2", date, source:"Project Blog" },
    { title:"Ecosystem", url:"https://e.test/1", date, source:"Ecosystem" },
    { title:"Coin market update", url:"https://u.test/1", date, source:"CoinDesk" },
  ], [
    { source:"Project Blog", layer:"project", priority:1, audience:"official" },
    { source:"Ecosystem", layer:"project", priority:2, audience:"ecosystem" },
    { source:"CoinDesk", layer:"universal", priority:20, audience:"market" },
  ], 4, { name:"Coin", ticker:"COIN" });
  assert.ok(selected.some((item) => item.source === "CoinDesk"));
  assert.ok(selected.some((item) => item.source === "Project Blog"));
});

test("selectDiverseNews can fill from one universal source when no alternative exists", () => {
  const date = now.toISOString();
  const items = Array.from({ length:5 }, (_, index) => ({ title:`Market ${index}`, url:`https://u.test/${index}`, date, source:"CoinDesk" }));
  const selected = selectDiverseNews(items, [{ source:"CoinDesk", layer:"universal", priority:20, audience:"market" }], 5, { ticker:"NEW" });
  assert.equal(selected.length, 5);
});

test("fetchProjectNews excludes stale feed items", async () => {
  const originalFetch = globalThis.fetch;
  const stale = new Date(now.getTime() - 90 * 86400000).toUTCString();
  globalThis.fetch = async () => new Response(`<rss><channel><item><title>Old update</title><link>https://old.test/item</link><pubDate>${stale}</pubDate></item></channel></rss>`, { status:200 });
  try {
    const news = await fetchProjectNews({ newsFeeds:[{ url:"https://old.test/rss", source:"Old Feed" }] });
    assert.equal(news.status, "partial");
    assert.deepEqual(news.items, []);
  } finally { globalThis.fetch = originalFetch; }
});


test("Ethereum feeds completely exclude Ethereum Research", () => {
  const feeds = getNewsFeeds(PROJECTS.eth);
  assert.deepEqual(feeds.map((feed) => feed.source), ["CoinDesk", "Ethereum Blog", "Week in Ethereum News", "Ethereum Cat Herders"]);
  assert.ok(feeds.every((feed) => feed.source !== "Ethereum Research"));
});

test("strict ETH relevance rejects universal BTC headlines with weak ETH mentions", () => {
  const feeds = getNewsFeeds(PROJECTS.eth);
  const weakMention = {
    title:"Bitcoin rises after macro data surprises markets",
    url:"https://www.coindesk.com/markets/bitcoin-rises-after-macro-data",
    snippet:"Ether also gained during the session.",
    source:"CoinDesk",
  };
  const ethUpdate = {
    title:"Ethereum staking upgrade moves closer to mainnet",
    url:"https://www.coindesk.com/tech/ethereum-staking-upgrade-mainnet",
    snippet:"Core developers agreed on the next step.",
    source:"CoinDesk",
  };

  assert.equal(isProjectRelevantNews(weakMention, feeds, PROJECTS.eth), false);
  assert.equal(isProjectRelevantNews(ethUpdate, feeds, PROJECTS.eth), true);
});

test("strict ETH selection may return fewer than five relevant items", () => {
  const date = now.toISOString();
  const feeds = getNewsFeeds(PROJECTS.eth);
  const selected = selectDiverseNews([
    { title:"Bitcoin market update", url:"https://coindesk.test/bitcoin", date, source:"CoinDesk", snippet:"Ether was mentioned once." },
    { title:"Solana ecosystem expands", url:"https://coindesk.test/solana", date, source:"CoinDesk", snippet:"Ethereum remains a competitor." },
    { title:"Ethereum ETF inflows accelerate", url:"https://coindesk.test/ethereum-etf", date, source:"CoinDesk", snippet:"Institutional ETH demand grew." },
  ], feeds, 5, PROJECTS.eth);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].title, "Ethereum ETF inflows accelerate");
});

test("excluded ETH sources cannot enter ranking even if supplied as candidates", () => {
  const date = now.toISOString();
  const feeds = [...getNewsFeeds(PROJECTS.eth), { source:"Ethereum Research", layer:"project", priority:1 }];
  const selected = selectDiverseNews([
    { title:"Ethereum protocol research", url:"https://ethresear.ch/test", date, source:"Ethereum Research" },
    { title:"Ethereum protocol update", url:"https://blog.ethereum.org/test", date, source:"Ethereum Blog" },
  ], feeds, 5, PROJECTS.eth);

  assert.deepEqual(selected.map((item) => item.source), ["Ethereum Blog"]);
});
