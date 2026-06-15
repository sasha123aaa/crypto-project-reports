const DEFAULT_FRESH_TTL_MS = 2 * 60 * 1000;
const DEFAULT_STALE_TTL_MS = 15 * 60 * 1000;
const MAX_REPORT_CACHE_ENTRIES = 50;
export const REPORT_CACHE_VERSION = "canonical-resolution-v5-icons-runtime-stability";

const reportCache = new Map();
const inFlightReports = new Map();
const PERSISTENT_ORIGIN = "https://report-cache.internal";
const LAST_KNOWN_GOOD_TTL_SECONDS = 30 * 24 * 60 * 60;
const SOURCE_QUALITY = Object.freeze({ error:0, manual:1, partial:2, snapshot:3, "retry-live":4, live:5 });

function normalizeKey(key) { return String(key || "").trim().toLowerCase(); }
function versionedKey(key) { return `${REPORT_CACHE_VERSION}:${normalizeKey(key)}`; }

export function getCachedReport(key, now = Date.now()) {
  const normalized = versionedKey(key);
  const entry = reportCache.get(normalized);
  if (!entry) return null;
  const ageMs = now - entry.storedAt;
  if (ageMs > entry.staleTtlMs) return null;
  return { ...entry.snapshot, cacheState:ageMs <= entry.freshTtlMs ? "fresh" : "stale", ageMs };
}

/** Return the last successful model even after SWR expiry, for controlled outage fallback. */
export function getFallbackReport(key) {
  const entry = reportCache.get(versionedKey(key));
  return entry ? { ...entry.snapshot, cacheState:"fallback", ageMs:Date.now() - entry.storedAt } : null;
}

export function setCachedReport(key, snapshot, options = {}) {
  const normalized = versionedKey(key);
  if (!normalized || snapshot?.status !== 200) return snapshot;
  // Manual reports are an emergency response, never a last-known-good snapshot.
  if (snapshotSourceState(snapshot) === "manual") return snapshot;
  const current = reportCache.get(normalized);
  if (current && reportQuality(snapshot) < storedEntryQuality(current)) return current.snapshot;
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
  return `${REPORT_CACHE_VERSION}:${namespace}:${normalizeKey(key)}`;
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
  if (snapshotSourceState(snapshot) === "manual") return snapshot;
  const current = await readPersistent(env, "report", key);
  if (current?.snapshot && reportQuality(snapshot) < storedEntryQuality(current)) return current.snapshot;
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
  const normalized = versionedKey(key);
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
  const body = cacheState.includes("stale") || cacheState === "fallback"
    ? withSourceState(snapshot.body, "snapshot", snapshotSourceState(snapshot))
    : snapshot.body;
  return new Response(body, {
    status:snapshot.status,
    headers:{
      "content-type":snapshot.contentType,
      "cache-control":snapshot.cacheControl,
      "x-report-cache":cacheState,
      "x-report-cache-version":REPORT_CACHE_VERSION,
    },
  });
}

export function snapshotSourceState(snapshot) {
  try {
    return JSON.parse(snapshot?.body || "{}")?.meta?.source_state || "partial";
  } catch {
    return "partial";
  }
}

export function reportQuality(snapshot) {
  return SOURCE_QUALITY[snapshotSourceState(snapshot)] ?? SOURCE_QUALITY.partial;
}

function storedEntryQuality(entry, now = Date.now()) {
  if (now - Number(entry?.storedAt || 0) > Number(entry?.freshTtlMs || DEFAULT_FRESH_TTL_MS)) {
    return SOURCE_QUALITY.snapshot;
  }
  return reportQuality(entry?.snapshot);
}

function withSourceState(body, sourceState, snapshotOf) {
  try {
    const data = JSON.parse(body);
    if (!data || Array.isArray(data) || typeof data !== "object" || data.error) return body;
    data.meta = data.meta || {};
    data.meta.source_state = sourceState;
    data.meta.snapshot_of = snapshotOf;
    return JSON.stringify(data, null, 2);
  } catch {
    return body;
  }
}

export function clearReportCache() {
  reportCache.clear();
  inFlightReports.clear();
}
