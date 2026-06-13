const DEFAULT_FRESH_TTL_MS = 2 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 15 * 60 * 1000;
const MAX_REPORT_CACHE_ENTRIES = 50;

const reportCache = new Map();
const inFlightReports = new Map();
const PERSISTENT_ORIGIN = "https://report-cache.internal";
const LAST_KNOWN_GOOD_TTL_SECONDS = 30 * 24 * 60 * 60;

function normalizeKey(key) { return String(key || "").trim().toLowerCase(); }

export function getCachedReport(key, now = Date.now()) {
  const normalized = normalizeKey(key);
  const entry = reportCache.get(normalized);
  if (!entry) return null;
  const ageMs = now - entry.storedAt;
  if (ageMs > entry.staleTtlMs) return null;
  return { ...entry.snapshot, cacheState:ageMs <= entry.freshTtlMs ? "fresh" : "stale", ageMs };
}

/** Return the last successful model even after SWR expiry, for controlled outage fallback. */
export function getFallbackReport(key) {
  const entry = reportCache.get(normalizeKey(key));
  return entry ? { ...entry.snapshot, cacheState:"fallback", ageMs:Date.now() - entry.storedAt } : null;
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

function persistentKey(namespace, key) {
  return `${namespace}:${normalizeKey(key)}`;
}

async function readPersistent(env, namespace, key) {
  const storageKey = persistentKey(namespace, key);
  if (env?.REPORT_CACHE?.get) return env.REPORT_CACHE.get(storageKey, { type:"json" });
  if (globalThis.caches?.default) {
    const response = await globalThis.caches.default.match(`${PERSISTENT_ORIGIN}/${encodeURIComponent(storageKey)}`);
    return response?.ok ? response.json() : null;
  }
  return null;
}

async function writePersistent(env, namespace, key, value) {
  const storageKey = persistentKey(namespace, key);
  if (env?.REPORT_CACHE?.put) {
    await env.REPORT_CACHE.put(storageKey, JSON.stringify(value), { expirationTtl:LAST_KNOWN_GOOD_TTL_SECONDS });
  }
  if (globalThis.caches?.default) {
    await globalThis.caches.default.put(`${PERSISTENT_ORIGIN}/${encodeURIComponent(storageKey)}`, new Response(JSON.stringify(value), {
      headers:{ "content-type":"application/json", "cache-control":`public, max-age=${LAST_KNOWN_GOOD_TTL_SECONDS}` },
    }));
  }
}

/** Read a cross-isolate last-known-good snapshot (KV when bound, otherwise Cache API). */
export async function getPersistentReport(env, key) {
  const entry = await readPersistent(env, "report", key);
  if (!entry?.snapshot || entry.snapshot.status !== 200) return null;
  setCachedReport(key, entry.snapshot, entry);
  return { ...entry.snapshot, cacheState:"persistent-fallback", ageMs:Date.now() - entry.storedAt };
}

export async function setPersistentReport(env, key, snapshot, options = {}) {
  if (!normalizeKey(key) || snapshot?.status !== 200) return snapshot;
  const entry = {
    snapshot,
    storedAt:Date.now(),
    freshTtlMs:options.freshTtlMs || DEFAULT_FRESH_TTL_MS,
    staleTtlMs:options.staleTtlMs || DEFAULT_STALE_TTL_MS,
  };
  await writePersistent(env, "report", key, entry);
  return snapshot;
}

export async function getPersistentResolution(env, key) {
  return readPersistent(env, "resolution", key);
}

export async function setPersistentResolution(env, key, project) {
  if (normalizeKey(key) && project) await writePersistent(env, "resolution", key, project);
  return project;
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
