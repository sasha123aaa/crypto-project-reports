const DEFAULT_TIMEOUTS = Object.freeze({ critical:14_000, optional:6_500 });

function errorMessage(error) { return error instanceof Error ? error.message : String(error); }
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
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await withTimeout(Promise.resolve().then(source.load), attemptTimeout, source.name);
      if (source.validate && !source.validate(value)) throw new Error(`${source.name} returned incomplete critical data`);
      return { status:"fulfilled", value, critical:true, attempts:attempt };
    } catch (error) {
      lastError = error;
    }
  }
  return { status:"rejected", reason:lastError, critical:true, attempts };
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
    volume_24h:hasMetric(report, "volume_24h"),
  };
  const missing = Object.entries(checks).filter(([, ready]) => !ready).map(([name]) => name);
  return {
    state:missing.length ? "blocked" : "ready",
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
