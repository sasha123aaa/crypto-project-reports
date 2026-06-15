const DEFAULT_TIMEOUTS = Object.freeze({ critical:14_000, optional:6_500 });

function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function isRetryableError(error) {
  const status = Number(error?.status || error?.details?.status || errorMessage(error).match(/(?:error|status):?\s*(\d{3})/i)?.[1]);
  return !Number.isFinite(status) || status === 408 || status === 425 || status === 429 || status >= 500;
}
function finitePositive(value) { return Number.isFinite(Number(value)) && Number(value) > 0; }

export function withTimeout(promise, timeoutMs, sourceName = "source") {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${sourceName} timed out after ${timeoutMs}ms`)), timeoutMs); }),
  ]).finally(() => clearTimeout(timer));
}

async function runCriticalSource(source, timeoutMs) {
  const attempts = Math.max(1, source.attempts || 3);
  const attemptTimeout = Math.max(1_000, Math.floor(timeoutMs / attempts));
  const retryDelays = source.retryDelays || [500, 1200];
  let lastError;
  let attemptCount = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    attemptCount = attempt;
    try {
      const value = await withTimeout(Promise.resolve().then(source.load), attemptTimeout, source.name);
      if (source.validate && !source.validate(value)) throw new Error(`${source.name} returned incomplete critical data`);
      return { status:"fulfilled", value, critical:true, attempts:attempt };
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error)) break;
      if (attempt < attempts) await delay(retryDelays[Math.min(attempt - 1, retryDelays.length - 1)] || 0);
    }
  }
  return { status:"rejected", reason:lastError, critical:true, attempts:attemptCount };
}

async function runOptionalSource(source, timeoutMs) {
  try {
    return { status:"fulfilled", value:await withTimeout(Promise.resolve().then(source.load), timeoutMs, source.name), critical:false, attempts:1 };
  } catch (reason) {
    return { status:"rejected", reason, critical:false, attempts:1 };
  }
}

/** Start every source together, but give critical sources a longer deadline and retries. */
export async function orchestrateReportSources(sources, timeouts = {}) {
  const limits = { ...DEFAULT_TIMEOUTS, ...timeouts };
  const entries = await Promise.all(sources.map(async (source) => [
    source.name,
    source.critical ? await runCriticalSource(source, limits.critical) : await runOptionalSource(source, limits.optional),
  ]));
  const results = Object.fromEntries(entries);
  return {
    results,
    summary: {
      critical: sources.filter((source) => source.critical).map((source) => source.name),
      optional: sources.filter((source) => !source.critical).map((source) => source.name),
      failedCritical: entries.filter(([, result]) => result.critical && result.status === "rejected").map(([name]) => name),
      failedOptional: entries.filter(([, result]) => !result.critical && result.status === "rejected").map(([name]) => name),
      attempts:Object.fromEntries(entries.map(([name, result]) => [name, result.attempts || 1])),
      timeouts: limits,
    },
  };
}

function hasMetric(report, key) { return finitePositive(report?.market?.[key]?.value); }

export function assessReportReadiness(report, project, sourceSummary = {}) {
  const checks = {
    project_resolution:Boolean(project?.resolution),
    project_profile:Boolean(project?.projectProfile || report?.meta?.project_profile),
    section_selection:Boolean(report?.meta?.section_selection?.sections),
    market_symbol_mapping:Boolean(project?.marketSymbols?.technical || project?.marketSymbols?.tradingView || report?.meta?.market_symbols?.technical || report?.meta?.market_symbols?.tradingView),
    price:hasMetric(report, "price"),
    market_cap:hasMetric(report, "market_cap"),
    fdv:hasMetric(report, "fdv"),
    volume_24h:hasMetric(report, "volume_24h"),
  };
  const valuation = checks.market_cap || checks.fdv;
  const usable = checks.project_resolution && checks.price && valuation && checks.volume_24h;
  const ready = Object.entries(checks)
    .filter(([name]) => name !== "fdv")
    .every(([name, value]) => name === "market_cap" ? valuation : value);
  const missing = Object.entries(checks)
    .filter(([name, value]) => name !== "fdv" && !(name === "market_cap" ? valuation : value))
    .map(([name]) => name);
  return {
    state:ready ? "ready" : usable ? "partial" : "blocked",
    source_state:report?.meta?.source_state || (missing.length ? "partial" : "live"),
    usable,
    checks,
    missing,
    critical_sources:sourceSummary.critical || ["project_resolution", "report_structure", "market"],
    optional_sources:sourceSummary.optional || [],
    failed_critical_sources:sourceSummary.failedCritical || [],
    failed_optional_sources:sourceSummary.failedOptional || [],
    timeout_ms:sourceSummary.timeouts || DEFAULT_TIMEOUTS,
  };
}

export function publishReportReadiness(report, project, sourceSummary) {
  report.meta = report.meta || {};
  report.meta.readiness = assessReportReadiness(report, project, sourceSummary);
  return report.meta.readiness;
}

export function rejectionReason(result) { return result?.status === "rejected" ? errorMessage(result.reason) : null; }
