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
      { source:"Decrypt", layer:"universal" },
      { source:"Cointelegraph", layer:"universal" },
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
  assert.deepEqual(feeds.map((feed) => feed.source), ["CoinDesk", "Decrypt", "Cointelegraph", "Ethereum Blog", "Week in Ethereum News", "Ethereum Cat Herders"]);
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

test("strict SOL relevance rejects other-asset and general-market stories", () => {
  const feeds = getNewsFeeds(PROJECTS.sol);
  const selected = selectDiverseNews([
    { title:"Bitcoin ETF inflows lift crypto market", url:"https://coindesk.test/bitcoin-etf", date:now.toISOString(), source:"CoinDesk", snippet:"Solana also rose." },
    { title:"Uniswap governance vote moves forward", url:"https://coindesk.test/uniswap-vote", date:now.toISOString(), source:"CoinDesk", snippet:"The proposal mentions Solana." },
    { title:"Solana validators prepare for Firedancer rollout", url:"https://coindesk.test/solana-firedancer", date:now.toISOString(), source:"CoinDesk", snippet:"The Solana ecosystem expects a performance upgrade." },
  ], feeds, 5, PROJECTS.sol);

  assert.deepEqual(selected.map((item) => item.title), ["Solana validators prepare for Firedancer rollout"]);
});

test("strict runtime meme relevance keeps DOGE and PEPE focused", () => {
  const universal = [{ source:"CoinDesk", layer:"universal", priority:20, audience:"market" }];
  const doge = { name:"Dogecoin", ticker:"DOGE", slug:"doge", newsRelevance:{ mode:"strict", directTerms:["dogecoin", "doge"], contextTerms:["dogecoin payment", "doge whale", "elon musk doge"], competingTerms:["bitcoin", "solana", "pepe"] } };
  const pepe = { name:"Pepe", ticker:"PEPE", slug:"pepe", newsRelevance:{ mode:"strict", directTerms:["pepe", "pepe coin"], contextTerms:["pepe whale", "pepe liquidity", "pepe listing"], competingTerms:["bitcoin", "solana", "dogecoin"] } };
  const date = now.toISOString();
  const candidates = [
    { title:"Coinbase launches new AI tool", url:"https://coindesk.test/coinbase-ai", date, source:"CoinDesk", snippet:"DOGE and PEPE are supported." },
    { title:"Dogecoin payments expand at online merchant", url:"https://coindesk.test/dogecoin-payments", date, source:"CoinDesk", snippet:"DOGE adoption is the focus." },
    { title:"PEPE whales add liquidity after exchange listing", url:"https://coindesk.test/pepe-liquidity", date, source:"CoinDesk", snippet:"PEPE sentiment improved." },
    { title:"Solana rallies on ETF speculation", url:"https://coindesk.test/solana-etf", date, source:"CoinDesk", snippet:"Meme coins also rose." },
  ];

  assert.deepEqual(selectDiverseNews(candidates, universal, 5, doge).map((item) => item.title), ["Dogecoin payments expand at online merchant"]);
  assert.deepEqual(selectDiverseNews(candidates, universal, 5, pepe).map((item) => item.title), ["PEPE whales add liquidity after exchange listing"]);
});


test("strict projects publish at most three strong relevant stories", () => {
  const date = now.toISOString();
  const project = { ticker:"DOGE", newsRelevance:{ mode:"strict", directTerms:["dogecoin", "doge"], contextTerms:["dogecoin payment"], competingTerms:[] } };
  const feeds = [{ source:"Decrypt", layer:"universal", priority:20 }];
  const items = Array.from({ length:5 }, (_, index) => ({ title:`Dogecoin payment update ${index}`, url:`https://decrypt.test/dogecoin-${index}`, date, source:"Decrypt" }));
  assert.equal(selectDiverseNews(items, feeds, 5, project).length, 3);
});


test("strict BTC relevance keeps Bitcoin-focused market coverage and rejects side mentions", () => {
  const feeds = getNewsFeeds(PROJECTS.btc);
  const date = now.toISOString();
  const selected = selectDiverseNews([
    { title:"Ethereum upgrade boosts crypto market", url:"https://coindesk.test/ethereum-upgrade", date, source:"CoinDesk", snippet:"Bitcoin also rose." },
    { title:"Spot Bitcoin ETF inflows accelerate", url:"https://coindesk.test/bitcoin-etf-inflows", date, source:"CoinDesk", snippet:"Institutional BTC demand strengthened." },
    { title:"Solana trading volume climbs", url:"https://decrypt.test/solana-volume", date, source:"Decrypt", snippet:"BTC remained stable." },
  ], feeds, 5, PROJECTS.btc);

  assert.deepEqual(selected.map((item) => item.title), ["Spot Bitcoin ETF inflows accelerate"]);
});

test("strict BNB relevance keeps burn, Binance ecosystem, and BNB Chain impact", () => {
  const feeds = getNewsFeeds(PROJECTS.bnb);
  assert.ok(feeds.some((feed) => feed.source === "Binance Blog" && feed.layer === "project"));
  assert.ok(feeds.some((feed) => feed.source === "BNB Chain Blog" && feed.layer === "project"));
  const date = now.toISOString();
  const selected = selectDiverseNews([
    { title:"Ethereum upgrade boosts altcoin market", url:"https://coindesk.test/ethereum-upgrade", date, source:"CoinDesk", snippet:"BNB also rose." },
    { title:"BNB Auto-Burn removes tokens from supply", url:"https://coindesk.test/bnb-auto-burn", date, source:"CoinDesk", snippet:"The quarterly burn reduced BNB supply." },
    { title:"BNB Chain upgrade targets ecosystem activity", url:"https://decrypt.test/bnb-chain-upgrade", date, source:"Decrypt", snippet:"Developers outlined the BNB Chain roadmap." },
    { title:"Binance regulatory decision changes BNB utility outlook", url:"https://cointelegraph.test/binance-bnb-regulation", date, source:"Cointelegraph", snippet:"The decision may affect Binance ecosystem demand for BNB." },
    { title:"Solana DEX volume reaches record", url:"https://decrypt.test/solana-dex", date, source:"Decrypt", snippet:"BNB Chain remained a competitor." },
  ], feeds, 5, PROJECTS.bnb);

  assert.deepEqual(new Set(selected.map((item) => item.title)), new Set([
    "BNB Auto-Burn removes tokens from supply",
    "BNB Chain upgrade targets ecosystem activity",
    "Binance regulatory decision changes BNB utility outlook",
  ]));
});

test("strict LINK relevance prioritizes Chainlink integrations, CCIP, and oracle adoption", () => {
  const feeds = getNewsFeeds(PROJECTS.link);
  const date = now.toISOString();
  const selected = selectDiverseNews([
    { title:"Ethereum upgrade lifts altcoin market", url:"https://coindesk.test/eth", date, source:"CoinDesk", snippet:"LINK also gained." },
    { title:"Chainlink CCIP integration expands cross-chain adoption", url:"https://coindesk.test/chainlink-ccip", date, source:"CoinDesk", snippet:"The integration adds Chainlink data infrastructure." },
    { title:"Bitcoin ETF inflows accelerate", url:"https://decrypt.test/btc", date, source:"Decrypt", snippet:"Oracle tokens traded higher." },
  ], feeds, 5, PROJECTS.link);

  assert.deepEqual(selected.map((item) => item.title), ["Chainlink CCIP integration expands cross-chain adoption"]);
});

test("strict HYPE relevance keeps product economics news and rejects general market stories", () => {
  const feeds = getNewsFeeds(PROJECTS.hype);
  const selected = selectDiverseNews([
    { title:"Bitcoin rally lifts crypto markets", url:"https://coindesk.test/btc", date:now.toISOString(), source:"CoinDesk", snippet:"HYPE also gained." },
    { title:"Hyperliquid fees and trading volume rise after product update", url:"https://coindesk.test/hyperliquid", date:now.toISOString(), source:"CoinDesk", snippet:"Hyperliquid traders increased activity and liquidity." },
  ], feeds, 5, PROJECTS.hype);
  assert.deepEqual(selected.map((item) => item.title), ["Hyperliquid fees and trading volume rise after product update"]);
});

test("strict PENDLE relevance keeps PT / YT product usage news", () => {
  const feeds = getNewsFeeds(PROJECTS.pendle);
  const selected = selectDiverseNews([
    { title:"Bitcoin rally lifts DeFi tokens", url:"https://coindesk.test/btc-defi", date:now.toISOString(), source:"CoinDesk", snippet:"PENDLE also gained." },
    { title:"Pendle PT and YT trading activity expands with TVL", url:"https://coindesk.test/pendle", date:now.toISOString(), source:"CoinDesk", snippet:"Pendle Finance yield markets recorded higher usage and fees." },
  ], feeds, 5, PROJECTS.pendle);
  assert.deepEqual(selected.map((item) => item.title), ["Pendle PT and YT trading activity expands with TVL"]);
});

test("strict CRV relevance keeps Curve liquidity and veCRV news", () => {
  const feeds = getNewsFeeds(PROJECTS.crv);
  const selected = selectDiverseNews([
    { title:"Crypto governance tokens rise", url:"https://decrypt.test/governance", date:now.toISOString(), source:"Decrypt", snippet:"CRV also gained." },
    { title:"Curve Finance updates veCRV gauges and liquidity incentives", url:"https://decrypt.test/curve", date:now.toISOString(), source:"Decrypt", snippet:"Curve pools, emissions and governance are affected." },
  ], feeds, 5, PROJECTS.crv);
  assert.deepEqual(selected.map((item) => item.title), ["Curve Finance updates veCRV gauges and liquidity incentives"]);
});

test("strict MNT and NEAR relevance keeps ecosystem-impact news and rejects side mentions", () => {
  const date = now.toISOString();
  const mnt = selectDiverseNews([
    { title:"Altcoins rally with Mantle mentioned among gainers", url:"https://coindesk.test/alts", date, source:"CoinDesk", snippet:"Bitcoin led the move and MNT also rose." },
    { title:"Mantle Network liquidity and TVL expand after ecosystem partnership", url:"https://coindesk.test/mantle", date, source:"CoinDesk", snippet:"Mantle ecosystem adoption, stablecoins and protocol relevance increased." },
  ], getNewsFeeds(PROJECTS.mnt), 5, PROJECTS.mnt);
  const near = selectDiverseNews([
    { title:"AI tokens rally across crypto market", url:"https://decrypt.test/ai", date, source:"Decrypt", snippet:"NEAR was briefly mentioned." },
    { title:"NEAR Protocol chain abstraction product records ecosystem usage growth", url:"https://decrypt.test/near", date, source:"Decrypt", snippet:"NEAR developers and adoption activity expanded." },
  ], getNewsFeeds(PROJECTS.near), 5, PROJECTS.near);

  assert.deepEqual(mnt.map((item) => item.title), ["Mantle Network liquidity and TVL expand after ecosystem partnership"]);
  assert.deepEqual(near.map((item) => item.title), ["NEAR Protocol chain abstraction product records ecosystem usage growth"]);
});
