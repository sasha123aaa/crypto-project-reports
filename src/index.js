import { getProjectBySlug } from "./config/projects.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/report/")) {
      return handleHybridReportApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleHybridReportApi(request, env, url) {
  const slug = url.pathname.replace("/api/report/", "").replace(/\/$/, "");
  const project = getProjectBySlug(slug);

  if (!slug) {
    return json({ error: "Missing report slug" }, 400);
  }

  if (!project) {
    return json({ error: "Unknown project slug", slug }, 404);
  }

  const staticJson = await loadStaticReportJson(request, env, slug);
  if (!staticJson.ok) return staticJson.response;

  const report = staticJson.data;

  try {
    const live = await fetchLiveMetrics(project);

    mergeLiveMetrics(report, live);

    report.meta.updated_at = new Date().toISOString();
    report.meta.data_status = "hybrid-live";

    return json(report, 200);
  } catch (error) {
    report.meta.updated_at = new Date().toISOString();
    report.meta.data_status = "hybrid-fallback";
    report.meta.live_error = error instanceof Error ? error.message : String(error);
  
    return json(report, 200);
  }
}

async function loadStaticReportJson(request, env, slug) {
  const jsonUrl = new URL(`/data/reports/${slug}.json`, request.url);
  const assetRequest = new Request(jsonUrl.toString(), request);
  const response = await env.ASSETS.fetch(assetRequest);

  if (response.status === 404) {
    return {
      ok: false,
      response: json(
        {
          error: "Report JSON not found",
          slug,
          expected_path: `/public/data/reports/${slug}.json`,
        },
        404
      ),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      response: json(
        {
          error: "Failed to load report JSON",
          slug,
          status: response.status,
        },
        500
      ),
    };
  }

  const data = await response.json();
  return { ok: true, data };
}

async function fetchLiveMetrics(project) {
  const [
    cgMarket,
    cgChart,
    chains,
    stableChains,
    feesOverview,
    dexOverview,
    tvlHistory,
    stableHistory,
  ] = await Promise.all([
    fetchCoinGeckoMarket(project.coingeckoId),
    fetchCoinGeckoChart(project.coingeckoId),
    project.defillamaChain ? fetchDefiLlamaChains() : Promise.resolve(null),
    project.stablecoinChain ? fetchStablecoinChains() : Promise.resolve(null),
    project.defillamaChain ? fetchFeesOverview(project.defillamaChain) : Promise.resolve(null),
    project.defillamaChain ? fetchDexOverview(project.defillamaChain) : Promise.resolve(null),
    project.defillamaChain ? fetchTVLHistory(project.defillamaChain) : Promise.resolve([]),
    project.stablecoinChain ? fetchStablecoinHistory(project.stablecoinChain) : Promise.resolve([]),
  ]);

  const chainNow = findChainData(chains, project.defillamaChain);
  const stableNow = findStableChainData(stableChains, project.stablecoinChain);

  const price = cgMarket?.current_price ?? null;
  const marketCap = cgMarket?.market_cap ?? null;
  const fdv = cgMarket?.fully_diluted_valuation ?? null;
  const volume24h = cgMarket?.total_volume ?? null;
  const circulatingSupply = cgMarket?.circulating_supply ?? null;
  const totalSupply = cgMarket?.total_supply ?? null;
  const maxSupply = cgMarket?.max_supply ?? null;

  const tvl = chainNow?.tvl ?? getLastTVL(tvlHistory);
  const stablecoins = stableNow?.totalCirculatingUSD ?? getLastStable(stableHistory);
  const chainFees24h = feesOverview?.total24h ?? null;
  const dexVolume24h = dexOverview?.total24h ?? null;

  return {
    market: {
      price,
      marketCap,
      fdv,
      volume24h,
      circulatingSupply,
      totalSupply,
      maxSupply,
    },
    capital: {
      tvl,
      stablecoins,
    },
    financials: {
      chainFees24h,
      dexVolume24h,
    },
    valuation: {
      marketCapTVL: safeDivide(marketCap, tvl),
      volumeMarketCap: safePercent(volume24h, marketCap),
      stablecoinsTVL: safeDivide(stablecoins, tvl),
    },
    charts: {
      priceHistory: cgChart?.prices || [],
      tvlHistory: Array.isArray(tvlHistory) ? tvlHistory : [],
      stableHistory: Array.isArray(stableHistory) ? stableHistory : [],
      feesHistory: feesOverview?.totalDataChart || [],
      dexHistory: dexOverview?.totalDataChart || [],
    },
  };
}

function mergeLiveMetrics(report, live) {
  const sourceCG = "CoinGecko";
  const sourceDL = "DefiLlama";

  if (live.market.price != null) {
    report.market.price = liveMetric(live.market.price, formatMoney(live.market.price), sourceCG);
  }

  if (live.market.marketCap != null) {
    const metric = liveMetric(live.market.marketCap, formatMoney(live.market.marketCap), sourceCG);
    report.market.market_cap = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.market_cap = metric;
  }

  if (live.market.fdv != null) {
    const metric = liveMetric(live.market.fdv, formatMoney(live.market.fdv), sourceCG);
    report.market.fdv = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.fdv = metric;
  }

  if (live.market.volume24h != null) {
    const metric = liveMetric(live.market.volume24h, formatMoney(live.market.volume24h), sourceCG);
    report.market.volume_24h = metric;
    if (report.liquidity?.metrics) report.liquidity.metrics.spot_volume = metric;
  }

  if (live.market.circulatingSupply != null) {
    const metric = liveMetric(
      live.market.circulatingSupply,
      formatNumber(live.market.circulatingSupply),
      sourceCG
    );
    report.market.circulating_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.circulating_supply = metric;
  }

  if (live.market.totalSupply != null) {
    const metric = liveMetric(
      live.market.totalSupply,
      formatNumber(live.market.totalSupply),
      sourceCG
    );
    report.market.total_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.total_supply = metric;
  }

  if (live.market.maxSupply != null) {
    const metric = liveMetric(
      live.market.maxSupply,
      formatNumber(live.market.maxSupply),
      sourceCG
    );
    report.market.max_supply = metric;
    if (report.tokenomics?.metrics) report.tokenomics.metrics.max_supply = metric;
  }

  if (live.capital.tvl != null) {
    const metric = liveMetric(live.capital.tvl, formatMoney(live.capital.tvl), sourceDL);
    report.capital.metrics.tvl = metric;
  }

  if (live.capital.stablecoins != null) {
    const metric = liveMetric(live.capital.stablecoins, formatMoney(live.capital.stablecoins), sourceDL);
    report.capital.metrics.stablecoins_mcap = metric;
  }

  if (live.financials.chainFees24h != null) {
    report.financials.metrics.chain_fees_24h = liveMetric(
      live.financials.chainFees24h,
      formatMoney(live.financials.chainFees24h),
      sourceDL
    );
  }

  if (live.financials.dexVolume24h != null) {
    const metric = liveMetric(
      live.financials.dexVolume24h,
      formatMoney(live.financials.dexVolume24h),
      sourceDL
    );
    report.financials.metrics.dex_volume_24h = metric;
    if (report.liquidity?.metrics) report.liquidity.metrics.dex_volume_24h = metric;
  }

  if (live.valuation.marketCapTVL != null) {
    report.valuation.metrics.market_cap_tvl = calcMetric(
      live.valuation.marketCapTVL,
      `${live.valuation.marketCapTVL.toFixed(2)}x`
    );
  }

  if (live.valuation.volumeMarketCap != null) {
    const metric = calcMetric(
      live.valuation.volumeMarketCap,
      `${live.valuation.volumeMarketCap.toFixed(2)}%`
    );
    report.valuation.metrics.volume_market_cap = metric;
    report.financials.metrics.volume_market_cap = metric;
  }

  if (live.valuation.stablecoinsTVL != null) {
    report.valuation.metrics.stablecoins_tvl = calcMetric(
      live.valuation.stablecoinsTVL,
      `${live.valuation.stablecoinsTVL.toFixed(2)}x`
    );
  }

  report.charts.price_history = live.charts.priceHistory;
  report.charts.tvl_history = live.charts.tvlHistory;
  report.charts.stablecoins_history = live.charts.stableHistory;
  report.charts.fees_history = live.charts.feesHistory;
  report.charts.dex_history = live.charts.dexHistory;
}

function liveMetric(value, formatted, source) {
  return {
    value,
    formatted,
    status: "live",
    source,
  };
}

function calcMetric(value, formatted) {
  return {
    value,
    formatted,
    status: "calculated",
    source: "calc",
  };
}

function safeDivide(a, b) {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

function safePercent(a, b) {
  if (a == null || b == null || b === 0) return null;
  return (a / b) * 100;
}

function formatMoney(value) {
  if (value == null || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value);
}

async function fetchCoinGeckoMarket(coingeckoId) {
  const url =
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}` +
    `&price_change_percentage=7d`;

  const res = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0",
    },
  });

  if (!res.ok) throw new Error(`CoinGecko market error: ${res.status}`);
  const data = await res.json();
  return data?.[0] || null;
}

async function fetchCoinGeckoChart(coingeckoId, days = 365) {
  const url =
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coingeckoId)}/market_chart` +
    `?vs_currency=usd&days=${days}&interval=daily`;

  const res = await fetch(url, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "user-agent": "Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0",
    },
  });

  if (!res.ok) throw new Error(`CoinGecko chart error: ${res.status}`);
  return res.json();
}

async function fetchDefiLlamaChains() {
  const res = await fetch("https://api.llama.fi/v2/chains");
  if (!res.ok) throw new Error(`DefiLlama chains error: ${res.status}`);
  return res.json();
}

async function fetchStablecoinChains() {
  const res = await fetch("https://stablecoins.llama.fi/stablecoinchains");
  if (!res.ok) throw new Error(`DefiLlama stable chains error: ${res.status}`);
  return res.json();
}

async function fetchFeesOverview(chainName) {
  const url =
    `https://api.llama.fi/overview/fees/${encodeURIComponent(chainName)}` +
    `?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DefiLlama fees error: ${res.status}`);
  return res.json();
}

async function fetchDexOverview(chainName) {
  const url =
    `https://api.llama.fi/overview/dexs/${encodeURIComponent(chainName)}` +
    `?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`DefiLlama dex error: ${res.status}`);
  return res.json();
}

async function fetchTVLHistory(chainName) {
  const res = await fetch(`https://api.llama.fi/charts/${encodeURIComponent(chainName)}`);
  if (!res.ok) throw new Error(`DefiLlama TVL history error: ${res.status}`);
  return res.json();
}

async function fetchStablecoinHistory(chainKey) {
  const res = await fetch(`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chainKey)}`);
  if (!res.ok) throw new Error(`DefiLlama stable history error: ${res.status}`);
  return res.json();
}

function findChainData(chains, chainName) {
  return Array.isArray(chains)
    ? chains.find((item) => String(item.name).toLowerCase() === String(chainName).toLowerCase())
    : null;
}

function findStableChainData(chains, chainKey) {
  return Array.isArray(chains)
    ? chains.find((item) => {
        const a = String(item.gecko_id || "").toLowerCase();
        const b = String(item.name || "").toLowerCase();
        const target = String(chainKey || "").toLowerCase();
        return a === target || b === target;
      })
    : null;
}

function getLastTVL(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[rows.length - 1]?.totalLiquidityUSD ?? null;
}

function getLastStable(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[rows.length - 1]?.totalCirculatingUSD ?? null;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
