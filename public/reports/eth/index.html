export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(url) {
  const routes = {
    "/api/coingecko/markets":
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum&price_change_percentage=7d",
    "/api/coingecko/chart":
      "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=365&interval=daily",
    "/api/llama/chains":
      "https://api.llama.fi/v2/chains",
    "/api/llama/tvl-history":
      "https://api.llama.fi/charts/Ethereum",
    "/api/llama/stable-history":
      "https://stablecoins.llama.fi/stablecoincharts/ethereum",
    "/api/llama/stable-chains":
      "https://stablecoins.llama.fi/stablecoinchains",
    "/api/llama/fees-overview":
      "https://api.llama.fi/overview/fees/ethereum?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees",
    "/api/llama/dex-overview":
      "https://api.llama.fi/overview/dexs/ethereum?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume",
  };

  const target = routes[url.pathname];

  if (!target) {
    return new Response(
      JSON.stringify({ error: "Unknown API route" }),
      {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "accept": "application/json,text/plain,*/*",
        "user-agent": "Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0",
      },
      cf: {
        cacheTtl: 300,
        cacheEverything: true,
      },
    });

    const text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Proxy fetch failed",
        detail: String(error),
      }),
      {
        status: 500,
        headers: { "content-type": "application/json; charset=utf-8" },
      }
    );
  }
}
