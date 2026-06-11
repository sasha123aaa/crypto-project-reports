import { getProjectProfile, getSectionSelection } from "../config/projects.js";

function hasMetricValue(metric) {
  if (!metric || typeof metric !== "object") return false;
  if (metric.status === "unavailable") return false;
  return metric.value !== null && metric.value !== undefined
    || (typeof metric.formatted === "string" && !["", "—", "данные временно недоступны"].includes(metric.formatted.toLowerCase()));
}

function metricBlockAvailability(block) {
  if (!block || typeof block !== "object") return false;
  const metrics = Object.values(block.metrics || {});
  if (!metrics.length) return "partial";
  const available = metrics.filter(hasMetricValue).length;
  if (!available) return "partial";
  return available === metrics.length ? true : "partial";
}

function listBlockAvailability(...lists) {
  const existing = lists.filter(Array.isArray);
  if (!existing.length) return false;
  return existing.some((items) => items.length) ? true : "partial";
}

export function getReportDataAvailability(report = {}) {
  return {
    market: metricBlockAvailability({ metrics: report.market }),
    tokenomics: metricBlockAvailability(report.tokenomics),
    tvl_and_capital: metricBlockAvailability(report.capital),
    stablecoins: metricBlockAvailability(report.capital),
    rwa: metricBlockAvailability(report.capital),
    financials: metricBlockAvailability(report.financials),
    liquidity_and_trading: metricBlockAvailability(report.liquidity),
    users_and_activity: metricBlockAvailability(report.users),
    unlocks: report.tokenomics ? "partial" : false,
    whale_activity: report.liquidity ? "partial" : false,
    narrative_and_news: report.news
      ? listBlockAvailability(report.news.items)
      : listBlockAvailability(report.narrative?.items),
    risks: listBlockAvailability(report.profile?.risks, report.risks?.items, report.watchlist?.items),
    final_summary: listBlockAvailability(report.profile?.strengths, report.profile?.weaknesses, report.final_verdict?.paragraphs),
  };
}

export function applySectionSelection(report, project) {
  report.meta = report.meta || {};
  report.meta.project_profile = getProjectProfile(project);
  report.meta.section_selection = getSectionSelection(project, getReportDataAvailability(report));
  return report.meta.section_selection;
}

export function isSectionSelected(selection, section) {
  const status = selection?.sections?.[section]?.status;
  return status === "enabled" || status === "partial";
}
