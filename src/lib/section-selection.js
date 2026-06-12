import { PROJECT_CATEGORIES, getProjectProfile, getSectionSelection } from "../config/projects.js";

const RUNTIME_CATEGORY_SECTIONS = Object.freeze({
  [PROJECT_CATEGORIES.MEME]: new Set(["market", "tokenomics", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]),
  [PROJECT_CATEGORIES.UTILITY]: new Set(["market", "tokenomics", "financials", "liquidity_and_trading", "valuation", "narrative_and_news", "risks", "final_summary"]),
  [PROJECT_CATEGORIES.INFRA]: new Set(["market", "tokenomics", "financials", "tvl_and_capital", "users_and_activity", "liquidity_and_trading", "narrative_and_news", "risks", "final_summary"]),
});

function hasMetricValue(metric) {
  if (!metric || typeof metric !== "object") return false;
  if (metric.status === "unavailable" || metric.status === "unknown") return false;
  if (metric.value !== null && metric.value !== undefined) return true;
  if (typeof metric.formatted !== "string") return false;
  const formatted = metric.formatted.trim().toLowerCase();
  return Boolean(formatted) && !["—", "-", "n/a", "na", "unknown", "данные временно недоступны", "источник подключается"].includes(formatted)
    && !formatted.includes("временно недоступ");
}

function metricBlockAvailability(block, { strict = false, metricKeys } = {}) {
  if (!block || typeof block !== "object") return false;
  const source = block.metrics || {};
  const metrics = (metricKeys || Object.keys(source)).map((key) => source[key]).filter(Boolean);
  if (!metrics.length) return strict ? false : "partial";
  const available = metrics.filter(hasMetricValue).length;
  if (!available) return strict ? false : "partial";
  return available === metrics.length ? true : "partial";
}

function listBlockAvailability(lists, { strict = false } = {}) {
  const existing = lists.filter(Array.isArray);
  if (!existing.length) return false;
  if (!existing.some((items) => items.length)) return strict ? false : "partial";
  return true;
}

function isRuntimeProject(project, report) {
  return project?.resolution?.mode === "runtime" || report?.meta?.project_resolution?.mode === "runtime";
}

export function getReportDataAvailability(report = {}, { strict = false } = {}) {
  return {
    market: metricBlockAvailability({ metrics: report.market }, { strict }),
    tokenomics: metricBlockAvailability(report.tokenomics, { strict }),
    tvl_and_capital: metricBlockAvailability(report.capital, { strict, metricKeys:["tvl"] }),
    stablecoins: metricBlockAvailability(report.capital, { strict, metricKeys:["stablecoins_mcap"] }),
    rwa: metricBlockAvailability(report.capital, { strict, metricKeys:["rwa_active_mcap"] }),
    financials: metricBlockAvailability(report.financials, { strict, metricKeys:["app_fees_24h", "chain_fees_24h", "dex_volume_24h"] }),
    liquidity_and_trading: metricBlockAvailability(report.liquidity, { strict }),
    valuation: metricBlockAvailability(report.valuation, { strict }),
    demand_and_flows: metricBlockAvailability(report.demand_flows, { strict }),
    users_and_activity: metricBlockAvailability(report.users, { strict }),
    unlocks: metricBlockAvailability(report.tokenomics, { strict }),
    whale_activity: metricBlockAvailability(report.liquidity, { strict }),
    narrative_and_news: listBlockAvailability([report.news?.items, report.narrative?.items], { strict }),
    risks: listBlockAvailability([report.profile?.risks, report.risks?.items, report.watchlist?.items], { strict }),
    final_summary: listBlockAvailability([report.profile?.strengths, report.profile?.weaknesses, report.final_verdict?.paragraphs], { strict }),
  };
}

function applyRuntimeCategorySafety(selection, category) {
  const allowedSections = RUNTIME_CATEGORY_SECTIONS[category];
  if (!allowedSections) return selection;

  for (const [section, details] of Object.entries(selection.sections)) {
    if (allowedSections.has(section) || details.status === "disabled_by_profile") continue;
    details.status = "disabled_by_profile";
    details.reason = "not_relevant_for_runtime_category";
  }
  selection.enabledSections = selection.enabledSections.filter((section) => allowedSections.has(section));
  return selection;
}

export function applySectionSelection(report, project) {
  report.meta = report.meta || {};
  const profile = getProjectProfile(project);
  const runtime = isRuntimeProject(project, report);
  report.meta.project_profile = profile;
  report.meta.section_selection = getSectionSelection(project, getReportDataAvailability(report, { strict:runtime }));
  if (runtime) applyRuntimeCategorySafety(report.meta.section_selection, profile.category);
  return report.meta.section_selection;
}

export function isSectionSelected(selection, section) {
  const status = selection?.sections?.[section]?.status;
  return status === "enabled" || status === "partial";
}
