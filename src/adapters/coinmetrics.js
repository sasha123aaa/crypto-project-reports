const COMMUNITY_API = "https://community-api.coinmetrics.io/v4";
const BTC_METRICS = ["CapMVRVCur", "CapRealUSD", "IssContPctAnn", "PriceUSD", "SplyCur"];

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toTimestamp(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function lastNumber(rows, key) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = toNumber(rows[index]?.[key]);
    if (value !== null) return value;
  }
  return null;
}

function lastDerived(rows, derive) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const value = derive(rows[index]);
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

function realizedPrice(row) {
  const cap = toNumber(row?.CapRealUSD);
  const supply = toNumber(row?.SplyCur);
  return cap !== null && supply > 0 ? cap / supply : null;
}

function derivedMvrv(row) {
  const price = toNumber(row?.PriceUSD);
  const realized = realizedPrice(row);
  return price !== null && realized > 0 ? price / realized : null;
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
  const realizedCap = lastNumber(rows, "CapRealUSD");
  const supply = lastNumber(rows, "SplyCur");
  const mvrv = lastNumber(rows, "CapMVRVCur") ?? lastDerived(rows, derivedMvrv);
  const currentRealizedPrice = lastDerived(rows, realizedPrice);

  return {
    current: {
      mvrv,
      realizedCap,
      realizedPrice: currentRealizedPrice,
      nupl: mvrv > 0 ? 1 - (1 / mvrv) : null,
      annualIssuancePercent: lastNumber(rows, "IssContPctAnn"),
      supply,
    },
    charts: {
      mvrv: series(rows, "CapMVRVCur"),
      realizedPrice: rows.flatMap((row) => {
        const timestamp = toTimestamp(row?.time);
        const value = realizedPrice(row);
        return timestamp !== null && value !== null ? [[timestamp, value]] : [];
      }),
      marketPrice: series(rows, "PriceUSD"),
      issuance: series(rows, "IssContPctAnn"),
    },
    source: "Coin Metrics Community API",
  };
}
