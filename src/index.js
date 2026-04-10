
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApi(request);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  const routes = {
    "/api/coingecko/markets": "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum&price_change_percentage=7d",
    "/api/coingecko/chart": "https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=365&interval=daily",
    "/api/llama/chains": "https://api.llama.fi/v2/chains",
    "/api/llama/tvl-history": "https://api.llama.fi/charts/Ethereum",
    "/api/llama/stable-history": "https://api.llama.fi/stablecoincharts/ethereum",
    "/api/llama/stable-chains": "https://api.llama.fi/stablecoinchains",
    "/api/llama/fees-overview": "https://api.llama.fi/overview/fees/ethereum?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees",
    "/api/llama/dex-overview": "https://api.llama.fi/overview/dexs/ethereum?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume",
  };

  const target = routes[path];
  if (!target) {
    return jsonResponse({ error: "Unknown API route" }, 404);
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

    if (!upstream.ok) {
      return jsonResponse({ error: "Upstream failed", status: upstream.status, route: path }, 502);
    }

    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    return new Response(body, {
      status: 200,
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=300",
      },
    });
  } catch (err) {
    return jsonResponse({ error: "Proxy fetch failed", detail: String(err), route: path }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
