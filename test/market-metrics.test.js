import test from "node:test";
import assert from "node:assert/strict";
import { fetchCoinGeckoMarket, mergeCoinGeckoMarketData, mergeLiveMetrics } from "../src/index.js";

test("CoinGecko market merge fills missing tokenomics fields without overwriting fresh values", () => {
  const merged = mergeCoinGeckoMarketData(
    { current_price: 2500, market_cap: 300_000_000_000, fully_diluted_valuation: null, circulating_supply: null },
    { current_price: 2400, market_cap: 290_000_000_000, fully_diluted_valuation: 301_000_000_000, circulating_supply: 120_000_000, total_supply: 120_500_000 },
  );

  assert.equal(merged.current_price, 2500);
  assert.equal(merged.market_cap, 300_000_000_000);
  assert.equal(merged.fully_diluted_valuation, 301_000_000_000);
  assert.equal(merged.circulating_supply, 120_000_000);
  assert.equal(merged.total_supply, 120_500_000);
});

test("CoinGecko fetch enriches a partial markets response from the coin-details fallback", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    if (String(url).includes("/coins/markets")) {
      return new Response(JSON.stringify([{ current_price:2500, market_cap:300_000_000_000 }]), { status:200 });
    }
    return new Response(JSON.stringify({ market_data:{
      current_price:{ usd:2490 }, market_cap:{ usd:299_000_000_000 }, fully_diluted_valuation:{ usd:301_000_000_000 },
      circulating_supply:120_000_000, total_supply:120_500_000, total_volume:{ usd:15_000_000_000 }, max_supply:null,
    } }), { status:200 });
  };

  try {
    const market = await fetchCoinGeckoMarket("ethereum");
    assert.equal(market.current_price, 2500);
    assert.equal(market.market_cap, 300_000_000_000);
    assert.equal(market.fully_diluted_valuation, 301_000_000_000);
    assert.equal(market.circulating_supply, 120_000_000);
    assert.equal(market.total_supply, 120_500_000);
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("live CoinGecko tokenomics replace manual snapshot metrics consistently", () => {
  const manual = () => ({ value:null, formatted:"данные временно недоступны", status:"manual", source:"manual snapshot" });
  const report = {
    market: { price:manual(), market_cap:manual(), fdv:manual(), volume_24h:manual(), circulating_supply:manual(), total_supply:manual() },
    tokenomics: { metrics: { market_cap:manual(), fdv:manual(), circulating_supply:manual(), total_supply:manual() } },
    liquidity: { metrics:{} }, capital: { metrics:{} }, financials: { metrics:{} }, valuation: { metrics:{} }, charts:{}, users:{ metrics:{}, text:[] },
  };
  const live = {
    market: { marketCap:300_000_000_000, fdv:301_000_000_000, circulatingSupply:120_000_000, totalSupply:120_500_000, source:"CoinGecko" },
    capital:{}, financials:{}, valuation:{}, charts:{}, users:{}, news:{ status:"partial", items:[] }, technicalBias:null,
  };

  mergeLiveMetrics(report, live);

  for (const key of ["market_cap", "fdv", "circulating_supply", "total_supply"]) {
    assert.equal(report.market[key].status, "live");
    assert.equal(report.tokenomics.metrics[key].status, "live");
    assert.equal(report.market[key].value, report.tokenomics.metrics[key].value);
    assert.notEqual(report.market[key].formatted, "данные временно недоступны");
  }
});
