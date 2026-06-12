import { ANALYSIS_PROFILES, PROJECT_CATEGORIES, getProjectProfile, getRegisteredProject } from "../config/projects.js";

const TYPE_LINES = Object.freeze({
  [PROJECT_CATEGORIES.MACRO]: "Macro asset",
  [PROJECT_CATEGORIES.INFRA]: "Infrastructure asset",
  [PROJECT_CATEGORIES.DEFI]: "DeFi protocol token",
  [PROJECT_CATEGORIES.MEME]: "Meme / attention asset",
  [PROJECT_CATEGORIES.CONSUMER]: "Consumer ecosystem token",
  [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: "Hybrid ecosystem token",
  [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: "Ecosystem growth asset",
  [PROJECT_CATEGORIES.TRADING_VENUE]: "Trading venue / revenue asset",
  [PROJECT_CATEGORIES.UTILITY]: "Utility token",
});

const SUBTITLES = Object.freeze({
  [PROJECT_CATEGORIES.MACRO]: "Актив стоит оценивать через ликвидность, спрос и ограниченность предложения.",
  [PROJECT_CATEGORIES.INFRA]: "Главный вопрос — переходит ли рост использования сети в ценность токена.",
  [PROJECT_CATEGORIES.DEFI]: "Актив стоит оценивать через объёмы, комиссии и захват ценности токеном.",
  [PROJECT_CATEGORIES.MEME]: "Ключевы ликвидность, оборот и устойчивость внимания рынка.",
  [PROJECT_CATEGORIES.CONSUMER]: "Тезис зависит от удержания пользователей и роли токена в продукте.",
  [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: "Тезис держится на utility, спросе внутри экосистемы и механике предложения.",
  [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: "Главный вопрос — превращается ли рост экосистемы в спрос на токен.",
  [PROJECT_CATEGORIES.TRADING_VENUE]: "Актив стоит оценивать через объёмы, комиссии и token value capture.",
  [PROJECT_CATEGORIES.UTILITY]: "Тезис зависит от реального использования продукта и роли токена.",
});

function normalizedText(values) {
  return values.flat(Infinity).filter(Boolean).map((value) => String(value)).join(" ").toLowerCase();
}

function curatedTypeLine(project) {
  const subtitle = String(project?.subtitle || "").trim();
  if (!subtitle) return null;
  return subtitle.replace(new RegExp(`^${String(project.ticker || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[•·-]\\s*`, "i"), "").trim() || subtitle;
}

function inferRuntimeTypeLine(profile, text, signals) {
  if (/\bmeme\b|dog-themed|frog-themed|cat-themed/.test(text) || signals.isMeme) return "Meme / attention asset";
  if (/\boracle\b|data feeds?|ccip/.test(text)) return "Oracle / utility asset";
  if (/perpetual|derivatives|\bdex\b|decentralized exchange/.test(text) && (signals.hasProtocolFees || signals.hasDexVolume || /revenue|fees?/.test(text))) return "Trading venue / revenue asset";
  if (/perpetual|derivatives|\bdex\b|decentralized exchange|trading/.test(text)) return "Trading token";
  if (/layer[ -]?2|\bl2\b|rollup/.test(text)) return "L2 infrastructure asset";
  if (/layer[ -]?1|\bl1\b|smart contract platform/.test(text)) return "Smart-contract base layer";
  if (/lending|yield|liquid staking|\bdefi\b|decentralized finance/.test(text)) return "DeFi protocol token";
  if (/governance|\bdao\b/.test(text) && /ecosystem|utility/.test(text)) return "Ecosystem utility token";
  if (/ecosystem/.test(text)) return "Ecosystem asset";
  if (/infrastructure|data availability|storage|interoperability/.test(text)) return "Infrastructure token";
  return TYPE_LINES[profile.category] || "Ecosystem asset";
}

function inferRuntimeSubtitle(profile, typeLine) {
  if (typeLine === "Oracle / utility asset") return "Главный вопрос — превращаются ли adoption и интеграции в устойчивый спрос на токен.";
  if (typeLine === "Trading venue / revenue asset" || typeLine === "Trading token") return "Актив стоит оценивать через объёмы, комиссии и связь продукта с токеном.";
  if (typeLine === "Ecosystem utility token" || typeLine === "Ecosystem asset") return "Тезис зависит от реального использования и роли токена внутри экосистемы.";
  if (profile.analysisProfile === ANALYSIS_PROFILES.ORACLE_UTILITY) return "Главный вопрос — превращаются ли adoption и интеграции в устойчивый спрос на токен.";
  return SUBTITLES[profile.category] || "Актив стоит оценивать через ликвидность, спрос и роль токена внутри проекта.";
}

export function inferTitleSubtitle(project, context = {}) {
  const profile = getProjectProfile(project || {});
  const isRuntime = project?.resolution?.mode === "runtime";
  const isCurated = !isRuntime && (project?.resolution?.source === "curated" || project?.resolution?.mode === "registered" || Boolean(getRegisteredProject(project?.slug)));
  if (isCurated) {
    return { typeLine:curatedTypeLine(project), subtitle:null, source:"curated" };
  }

  const labels = context.labels || project?.categories || [];
  const signals = context.signals || project?.resolution?.signals || {};
  const text = normalizedText([
    labels,
    context.categories,
    context.tags,
    typeof context.description === "string" ? context.description : context.description?.en,
    context.protocol?.category,
    context.protocol?.type,
    context.chain?.category,
    context.chain?.type,
  ]);
  const typeLine = inferRuntimeTypeLine(profile, text, signals);
  return { typeLine, subtitle:inferRuntimeSubtitle(profile, typeLine), source:text ? "inferred" : "fallback" };
}

export function applyInferredTitleSubtitle(report, project) {
  if (!report || !project) return report;
  const presentation = project.presentation || inferTitleSubtitle(project);
  report.meta = { ...(report.meta || {}), presentation };
  if (presentation.source !== "curated") {
    report.hero = {
      ...(report.hero || {}),
      ...(presentation.typeLine ? { subtitle:presentation.typeLine } : {}),
      ...(presentation.subtitle ? { lead:presentation.subtitle } : {}),
    };
  }
  return report;
}
