const COMMUNITY_API = "https://community-api.coinmetrics.io/v4";
const BTC_METRICS = ["CapMVRVCur", "CapRealUSD", "IssContPctAnn", "PriceUSD", "SplyCur"];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function series(rows, key) {
  return rows.flatMap((row) => {
    const timestamp = toTimestamp(row?.time);
    const value = toNumber(row?.[key]);
    return timestamp !== null && value !== null ? [[timestamp, value]] : [];
  });
}

export async function fetchBitcoinValuationHistory({ days = 365 } = {}) {
  const start = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const params = new URLSearchParams({
    assets: "btc",
    metrics: BTC_METRICS.join(","),
    frequency: "1d",
    start_time: start,
    page_size: "10000",
  });
  const response = await fetch(`${COMMUNITY_API}/timeseries/asset-metrics?${params}`, {
    headers: { accept: "application/json", "user-agent": "CryptoProjectReports/1.0" },
  });
  if (!response.ok) throw new Error(`Coin Metrics asset metrics error: ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  const last = rows.at(-1) || null;
  const mvrv = toNumber(last?.CapMVRVCur);
  const realizedCap = toNumber(last?.CapRealUSD);
  const supply = toNumber(last?.SplyCur);

  return {
    current: {
      mvrv,
      realizedCap,
      realizedPrice: realizedCap !== null && supply > 0 ? realizedCap / supply : null,
      nupl: mvrv > 0 ? 1 - (1 / mvrv) : null,
      annualIssuancePercent: toNumber(last?.IssContPctAnn),
      supply,
    },
    charts: {
      mvrv: series(rows, "CapMVRVCur"),
      realizedPrice: rows.flatMap((row) => {
        const timestamp = toTimestamp(row?.time);
        const cap = toNumber(row?.CapRealUSD);
        const rowSupply = toNumber(row?.SplyCur);
        return timestamp !== null && cap !== null && rowSupply > 0 ? [[timestamp, cap / rowSupply]] : [];
      }),
      marketPrice: series(rows, "PriceUSD"),
      issuance: series(rows, "IssContPctAnn"),
    },
    source: "Coin Metrics Community API",
  };
}
