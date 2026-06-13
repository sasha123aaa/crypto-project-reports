const DEFAULT_FRESH_TTL_MS = 2 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 15 * 60 * 1000;
const MAX_REPORT_CACHE_ENTRIES = 50;

const reportCache = new Map();
const inFlightReports = new Map();

function normalizeKey(key) { return String(key || "").trim().toLowerCase(); }

export function getCachedReport(key, now = Date.now()) {
  const normalized = normalizeKey(key);
  const entry = reportCache.get(normalized);
  if (!entry) return null;
  const ageMs = now - entry.storedAt;
  if (ageMs > entry.staleTtlMs) {
    reportCache.delete(normalized);
    return null;
  }
  return { ...entry.snapshot, cacheState:ageMs <= entry.freshTtlMs ? "fresh" : "stale", ageMs };
}

export function setCachedReport(key, snapshot, options = {}) {
  const normalized = normalizeKey(key);
  if (!normalized || snapshot?.status !== 200) return snapshot;
  if (!reportCache.has(normalized) && reportCache.size >= MAX_REPORT_CACHE_ENTRIES) {
    reportCache.delete(reportCache.keys().next().value);
  }
  reportCache.delete(normalized);
  reportCache.set(normalized, {
    snapshot,
    storedAt:Date.now(),
    freshTtlMs:options.freshTtlMs || DEFAULT_FRESH_TTL_MS,
    staleTtlMs:options.staleTtlMs || DEFAULT_STALE_TTL_MS,
  });
  return snapshot;
}

export function runSingleFlight(key, producer) {
  const normalized = normalizeKey(key);
  if (inFlightReports.has(normalized)) return inFlightReports.get(normalized);
  const pending = Promise.resolve().then(producer).finally(() => inFlightReports.delete(normalized));
  inFlightReports.set(normalized, pending);
  return pending;
}

export async function responseSnapshot(response) {
  return {
    status:response.status,
    body:await response.text(),
    contentType:response.headers.get("content-type") || "application/json; charset=utf-8",
    cacheControl:response.headers.get("cache-control") || "public, max-age=60, stale-while-revalidate=600",
  };
}

export function responseFromSnapshot(snapshot, cacheState = "miss") {
  return new Response(snapshot.body, {
    status:snapshot.status,
    headers:{
      "content-type":snapshot.contentType,
      "cache-control":snapshot.cacheControl,
      "x-report-cache":cacheState,
    },
  });
}

export function clearReportCache() {
  reportCache.clear();
  inFlightReports.clear();
}
