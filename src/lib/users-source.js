const DEFAULT_DATASET = {
  dailyActiveAddresses24h: [
    "dailyActiveAddresses24h",
    "daily_active_addresses_24h",
    "daily_active_addresses",
    "activeAddresses24h",
    "activeAddresses",
  ],
  newAddresses24h: ["newAddresses24h", "new_addresses_24h", "new_addresses", "dailyNewAddresses"],
  transactions24h: ["transactions24h", "transactions_24h", "dailyTransactions", "txns24h"],
};

export async function fetchUsersMetrics(project, helpers = {}) {
  const sourceConfig = resolveUsersSourceConfig(project);
  const fetchImpl = helpers.fetchImpl || fetch;
  const toNumber = helpers.toNumber || defaultToNumber;

  switch (sourceConfig.type) {
    case "none":
      return unavailableUsers(sourceConfig, "users provider is not configured");
    case "custom_json":
      return fetchCustomJsonUsersMetrics(sourceConfig, { fetchImpl, toNumber });
    case "dune":
    case "defillama_pro":
      return fetchHttpUsersMetrics(sourceConfig, { fetchImpl, toNumber });
    default:
      return unavailableUsers(sourceConfig, `unsupported users provider type: ${sourceConfig.type}`);
  }
}

export function resolveUsersSourceConfig(project) {
  const explicit = project?.usersSource;
  if (!explicit || typeof explicit !== "object") {
    return { type: "none", label: "Users provider is not configured" };
  }

  const type = String(explicit.type || "none").trim().toLowerCase();
  return {
    ...explicit,
    type,
    chain: explicit.chain || project?.defillamaChain || project?.slug || null,
    dataset: explicit.dataset || null,
    endpoint: explicit.endpoint || null,
    label: explicit.label || defaultProviderLabel(type),
  };
}

function defaultProviderLabel(type) {
  if (type === "defillama_pro") return "DefiLlama Pro";
  if (type === "dune") return "Dune API";
  if (type === "custom_json") return "Custom JSON endpoint";
  return "Users provider is not configured";
}

async function fetchHttpUsersMetrics(sourceConfig, { fetchImpl, toNumber }) {
  const endpoint = String(sourceConfig.endpoint || "").trim();
  if (!endpoint) {
    return unavailableUsers(sourceConfig, "users provider endpoint is missing");
  }

  try {
    const res = await fetchImpl(endpoint, {
      headers: { accept: "application/json", ...(sourceConfig.headers || {}) },
    });
    if (!res.ok) {
      return unavailableUsers(sourceConfig, `users provider request failed (${res.status})`);
    }

    const payload = await res.json();
    const metrics = parseUsersMetrics(payload, sourceConfig.dataset, toNumber);
    const source = resolveUsersSource(payload, sourceConfig.label);
    return withAvailability(sourceConfig, metrics, source, "users provider returned no numeric metrics");
  } catch {
    return unavailableUsers(sourceConfig, "users provider request error");
  }
}

async function fetchCustomJsonUsersMetrics(sourceConfig, { fetchImpl, toNumber }) {
  const endpoint = String(sourceConfig.endpoint || "").trim();
  if (!endpoint) {
    return unavailableUsers(sourceConfig, "custom_json endpoint is missing");
  }

  try {
    const res = await fetchImpl(endpoint, { headers: { accept: "application/json" } });
    if (!res.ok) {
      return unavailableUsers(sourceConfig, `custom_json request failed (${res.status})`);
    }

    const payload = await res.json();
    const metrics = parseUsersMetrics(payload, sourceConfig.dataset, toNumber);
    const source = resolveUsersSource(payload, sourceConfig.label);
    return withAvailability(sourceConfig, metrics, source, "custom_json returned no numeric metrics");
  } catch {
    return unavailableUsers(sourceConfig, "custom_json request error");
  }
}

function parseUsersMetrics(payload, dataset, toNumber) {
  const aliases = buildDatasetAliases(dataset);
  const metricsRoot = payload?.metrics && typeof payload.metrics === "object" ? payload.metrics : null;
  return {
    dailyActiveAddresses24h: pickMetric(payload, metricsRoot, aliases.dailyActiveAddresses24h, toNumber),
    newAddresses24h: pickMetric(payload, metricsRoot, aliases.newAddresses24h, toNumber),
    transactions24h: pickMetric(payload, metricsRoot, aliases.transactions24h, toNumber),
  };
}

function resolveUsersSource(payload, fallbackLabel) {
  const metaSource = payload?.meta?.source;
  if (typeof metaSource === "string" && metaSource.trim()) return metaSource.trim();
  return fallbackLabel;
}

function buildDatasetAliases(dataset) {
  if (!dataset) return DEFAULT_DATASET;
  if (typeof dataset === "string") {
    if (dataset === "standard_users_v1") return DEFAULT_DATASET;
    return DEFAULT_DATASET;
  }

  if (typeof dataset === "object") {
    return {
      dailyActiveAddresses24h: arrayify(dataset.dailyActiveAddresses24h, DEFAULT_DATASET.dailyActiveAddresses24h),
      newAddresses24h: arrayify(dataset.newAddresses24h, DEFAULT_DATASET.newAddresses24h),
      transactions24h: arrayify(dataset.transactions24h, DEFAULT_DATASET.transactions24h),
    };
  }

  return DEFAULT_DATASET;
}

function arrayify(value, fallback) {
  if (Array.isArray(value) && value.length) return value;
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return fallback;
}

function pickMetric(payload, metricsRoot, candidates, toNumber) {
  for (const candidate of candidates) {
    const direct = toNumber(readPath(payload, candidate));
    if (Number.isFinite(direct)) return direct;

    const metricScoped = toNumber(readPath(metricsRoot, candidate));
    if (Number.isFinite(metricScoped)) return metricScoped;

    const explicitScoped = toNumber(readPath(payload, `metrics.${candidate}`));
    if (Number.isFinite(explicitScoped)) return explicitScoped;
  }
  return null;
}

function readPath(payload, path) {
  if (!path || !payload || typeof payload !== "object") return null;
  const parts = String(path).split(".").filter(Boolean);
  let cursor = payload;
  for (const part of parts) {
    if (cursor == null) return null;
    cursor = cursor[part];
  }
  return cursor;
}

function withAvailability(sourceConfig, metrics, source, reasonIfEmpty) {
  const hasAny = Object.values(metrics).some((value) => Number.isFinite(value));
  if (!hasAny) return unavailableUsers(sourceConfig, reasonIfEmpty, source);

  return {
    ...metrics,
    source,
    provider: sourceConfig.type,
    status: "live",
    reason: null,
  };
}

function unavailableUsers(sourceConfig, reason, source = sourceConfig.label) {
  return {
    dailyActiveAddresses24h: null,
    newAddresses24h: null,
    transactions24h: null,
    source,
    provider: sourceConfig.type,
    status: "partial",
    reason,
  };
}

function defaultToNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}
