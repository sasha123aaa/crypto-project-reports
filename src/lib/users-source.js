export async function fetchUsersMetrics(project, helpers = {}) {
  const sourceConfig = resolveUsersSourceConfig(project);
  if (!sourceConfig) return null;

  const fetchImpl = helpers.fetchImpl || fetch;
  const toNumber = helpers.toNumber || defaultToNumber;

  if (sourceConfig.type === "defillama") {
    return fetchDefiLlamaUsersMetrics(sourceConfig, { fetchImpl, toNumber });
  }

  return null;
}

export function resolveUsersSourceConfig(project) {
  const explicit = project?.usersSource;
  if (explicit?.type) return explicit;

  if (project?.defillamaChain) {
    return {
      type: "defillama",
      chain: project.defillamaChain,
      label: "DefiLlama API",
    };
  }

  return null;
}

async function fetchDefiLlamaUsersMetrics(sourceConfig, { fetchImpl, toNumber }) {
  const chain = String(sourceConfig.chain || "").trim();
  if (!chain) return null;

  const metricSpecs = [
    {
      key: "dailyActiveAddresses24h",
      aliases: ["dailyactiveaddresses24h", "activeaddresses24h", "activeaddresses", "dailyactiveaddresses"],
      candidates: [
        buildOverviewUrl("activeAddresses", chain, "dailyActiveAddresses"),
        buildOverviewUrl("users", chain, "dailyActiveAddresses"),
      ],
    },
    {
      key: "newAddresses24h",
      aliases: ["newaddresses24h", "dailynewaddresses", "newaddresses"],
      candidates: [
        buildOverviewUrl("newAddresses", chain, "dailyNewAddresses"),
        buildOverviewUrl("users", chain, "dailyNewAddresses"),
      ],
    },
    {
      key: "transactions24h",
      aliases: ["transactions24h", "txns24h", "dailytransactions", "transactions", "txns"],
      candidates: [
        buildOverviewUrl("transactions", chain, "dailyTransactions"),
        buildOverviewUrl("txns", chain, "dailyTransactions"),
      ],
    },
  ];

  const out = {
    dailyActiveAddresses24h: null,
    newAddresses24h: null,
    transactions24h: null,
    source: sourceConfig.label || "DefiLlama API",
  };

  for (const spec of metricSpecs) {
    out[spec.key] = await fetchMetricFromCandidates(spec, { fetchImpl, toNumber });
  }

  const hasAny = Object.keys(out)
    .filter((key) => key.endsWith("24h"))
    .some((key) => Number.isFinite(out[key]));

  return hasAny ? out : null;
}

function buildOverviewUrl(segment, chain, dataType) {
  return `https://api.llama.fi/overview/${encodeURIComponent(segment)}/${encodeURIComponent(chain)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=${encodeURIComponent(dataType)}`;
}

async function fetchMetricFromCandidates(spec, { fetchImpl, toNumber }) {
  for (const url of spec.candidates) {
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (!res.ok) continue;
      const payload = await res.json();
      const value = extractMetricValue(payload, spec.aliases, toNumber);
      if (Number.isFinite(value)) return value;
    } catch {
      // Continue to next candidate.
    }
  }

  return null;
}

function extractMetricValue(payload, aliases, toNumber) {
  const direct = findNumberByAliases(payload, aliases, toNumber);
  if (Number.isFinite(direct)) return direct;

  const fromTotals = [
    payload?.total24h,
    payload?.total1d,
    payload?.total,
    payload?.value,
    payload?.current,
    payload?.amount,
  ];
  for (const candidate of fromTotals) {
    const n = toNumber(candidate);
    if (Number.isFinite(n)) return n;
  }

  const lastChartValue = extractLatestChartValue(payload, toNumber);
  if (Number.isFinite(lastChartValue)) return lastChartValue;

  return null;
}

function extractLatestChartValue(payload, toNumber) {
  const chart = payload?.totalDataChart || payload?.data || payload?.chart || null;
  if (!Array.isArray(chart) || !chart.length) return null;

  for (let i = chart.length - 1; i >= 0; i -= 1) {
    const row = chart[i];
    const n = Array.isArray(row) ? toNumber(row[1]) : toNumber(row?.value ?? row?.total ?? row?.amount);
    if (Number.isFinite(n)) return n;
  }

  return null;
}

function findNumberByAliases(payload, aliases, toNumber) {
  if (!payload || typeof payload !== "object") return null;
  const target = new Set((aliases || []).map((item) => String(item).toLowerCase()));
  const queue = [payload];

  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object") continue;

    if (Array.isArray(node)) {
      queue.push(...node);
      continue;
    }

    for (const [key, value] of Object.entries(node)) {
      if (target.has(String(key).toLowerCase())) {
        const parsed = toNumber(value?.value ?? value?.amount ?? value?.current ?? value);
        if (Number.isFinite(parsed)) return parsed;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return null;
}

function defaultToNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
