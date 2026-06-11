import { PROJECT_CATEGORIES, getProjectProfile } from "../config/projects.js";

const KPI_DEFINITIONS = Object.freeze({
  price: { label: "Цена", path: "market.price" },
  market_cap: { label: "Рыночная капитализация", path: "market.market_cap" },
  fdv: { label: "FDV", path: "market.fdv", capability: "hasTokenomics" },
  volume_24h: { label: "Объем 24ч", path: "market.volume_24h" },
  tvl: { label: "TVL", path: "capital.metrics.tvl", capability: "hasTvl" },
  stablecoins: { label: "Stablecoins Mcap", path: "capital.metrics.stablecoins_mcap", capability: "hasStablecoins" },
  fees: { label: "Fees / revenue 24h", path: "financials.metrics.chain_fees_24h", anyCapability: ["hasProtocolFees", "hasChainFees"] },
  dex_volume: { label: "DEX Volume 24h", path: "financials.metrics.dex_volume_24h", capability: "hasDexVolume" },
  trading_quality: { label: "Объем / капитализация", path: "financials.metrics.volume_market_cap" },
  liquidity: { label: "Ликвидность", path: "semantic_metrics.liquidity", capability: "hasLiquidityData" },
  concentration: { label: "Концентрация / whale risk", path: "semantic_metrics.concentration", capability: "hasWhaleData" },
  momentum: { label: "Нарратив / momentum", path: "semantic_metrics.narrative_momentum", capability: "hasNarrativeMomentum" },
  token_utility: { label: "Роль токена", path: "semantic_metrics.token_utility", capability: "hasTokenUtilityData" },
  adoption: { label: "Adoption / integrations", path: "semantic_metrics.adoption", capability: "hasAdoptionData" },
  users: { label: "Активные пользователи", path: "users.metrics.daily_active_addresses", capability: "hasUsersData" },
});

export const HERO_KPI_PRIORITIES = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "dex_volume"],
  [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "tvl", "fees", "dex_volume", "liquidity", "trading_quality", "fdv"],
  [PROJECT_CATEGORIES.MEME]: ["price", "market_cap", "volume_24h", "liquidity", "trading_quality", "concentration", "momentum"],
  [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "volume_24h", "token_utility", "liquidity", "adoption", "concentration", "fdv"],
  [PROJECT_CATEGORIES.CONSUMER]: ["price", "market_cap", "volume_24h", "users", "adoption", "momentum", "liquidity"],
});

const PROFILE_COPY = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: {
    hero: (name) => ({ title: name, subtitle: "Инфраструктурный актив", lead: `${name} нужно оценивать через роль сети, глубину экосистемы, капитал и живую экономическую активность.`, main_strength: "Инфраструктурная позиция, глубина экосистемы и способность привлекать капитал.", main_risk: "Рыночная оценка может опережать сетевую экономику или ценность может уходить в соседние слои.", status_text: "Инфраструктурный тезис силен, когда капитал, пользователи и комиссии подтверждают оценку." }),
    executive: (name) => [`${name} оценивается как инфраструктурный актив: важны капитал, пользователи и глубина экосистемы.`, "TVL, комиссии и активность показывают, насколько сеть реально востребована.", "Ключевой вопрос — способна ли сетевая экономика оправдывать рыночную оценку.", "Следить нужно за тем, где внутри экосистемы остается создаваемая ценность."],
    profile: { strengths:["Инфраструктурная роль и экосистемный эффект","Способность привлекать капитал","Ликвидность и рыночная узнаваемость","Потенциал живой сетевой экономики"], weaknesses:["Оценка зависит от устойчивости сетевой активности","Ценность может распределяться между несколькими слоями","Высокая конкуренция инфраструктурных платформ","Качество метрик зависит от полноты on-chain данных"], risks:["Отток капитала и пользователей","Ослабление комиссионной экономики","Размывание ценности внутри экосистемы","Оценка выше подтверждаемого фундаментала"], watch:["TVL и капитал экосистемы","Пользователей и транзакции","Комиссии и DEX-объемы","Соотношение оценки и сетевой экономики"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Инфраструктура: капитал, пользователи и глубина экосистемы", paragraphs:[`${name} стоит оценивать по способности сохранять инфраструктурную роль и притягивать устойчивый капитал.`,"Сильный итоговый тезис требует подтверждения через пользователей, комиссии, TVL и глубину экосистемы.","Главная проверка — оправдывает ли живая экономика сети текущую рыночную оценку."] }),
  },
  [PROJECT_CATEGORIES.DEFI]: {
    hero: (name) => ({ title:name, subtitle:"DeFi-протокол", lead:`${name} нужно оценивать как финансовый продукт: через использование, TVL, комиссии и то, захватывает ли токен создаваемую ценность.`, main_strength:"Продуктовая экономика, ликвидность и повторяемое использование протокола.", main_risk:"Рост продукта может не создавать спрос на токен или доход для держателей.", status_text:"DeFi-тезис подтверждается устойчивым usage, выручкой и понятным token capture." }),
    executive: (name) => [`${name} оценивается прежде всего как работающий DeFi-продукт.`,"TVL без комиссий и повторяемого использования не дает полной картины.","Главный вопрос — превращается ли продуктовая экономика в ценность для токена.","Следить нужно за качеством ликвидности, revenue и устойчивостью спроса."],
    profile: { strengths:["Работающий финансовый продукт","Потенциал комиссионной экономики","TVL и повторяемое использование","Интеграции внутри DeFi"], weaknesses:["TVL может быть чувствителен к стимулам","Revenue не всегда достается токену","Зависимость от качества ликвидности","Конкуренты легко копируют продуктовые механики"], risks:["Отток TVL и ликвидности","Снижение fees / revenue","Слабый token capture","Смарт-контрактные и регуляторные риски"], watch:["TVL и его качество","Protocol fees / revenue","Использование продукта","Механизм захвата ценности токеном"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"DeFi: использование, экономика продукта и token capture", paragraphs:[`${name} должен оправдывать оценку через реальное использование продукта, а не только через размер TVL.`,"Ключевые подтверждения — устойчивые fees / revenue, качественная ликвидность и понятный захват ценности токеном.","Главный риск — сильный продукт без достаточной экономической связи с токеном."] }),
  },
  [PROJECT_CATEGORIES.MEME]: {
    hero: (name) => ({ title:name, subtitle:"Meme-актив", lead:`${name} нужно оценивать через ликвидность, оборот, концентрацию держателей и устойчивость внимания рынка.`, main_strength:"Сильное сообщество, нарратив и способность поддерживать торговую ликвидность.", main_risk:"Интерес и ликвидность могут быстро схлопнуться, особенно при высокой концентрации.", status_text:"Meme-тезис держится на качестве рынка и устойчивости внимания, а не на инфраструктурных метриках." }),
    executive: (name) => [`${name} оценивается как актив внимания и ликвидности: качество рынка важнее метрик сетевой экономики.`,"Объем важен только вместе с глубиной рынка и качеством ликвидности.","Концентрация держателей определяет риск резкого выхода крупного капитала.","Нарратив силен, пока интерес сообщества остается устойчивым."],
    profile: { strengths:["Сила сообщества и узнаваемость","Торговый интерес и оборот","Потенциал быстрого распространения нарратива","Простая рыночная история"], weaknesses:["Ограниченная фундаментальная опора","Сильная зависимость от внимания","Высокая волатильность","Качество ликвидности может быстро меняться"], risks:["Быстрое схлопывание интереса","Выход крупных держателей","Разреженная ликвидность","Смена рыночного нарратива"], watch:["Спотовый объем и глубину рынка","Концентрацию держателей","Устойчивость сообщества","Изменение narrative momentum"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Meme: ликвидность, концентрация и устойчивость нарратива", paragraphs:[`${name} следует оценивать по качеству ликвидности и способности удерживать внимание рынка.`,"Сильный оборот не отменяет риск концентрации и быстрого выхода капитала.","Главный итоговый риск — резкий unwind при ослаблении нарратива или ликвидности."] }),
  },
  [PROJECT_CATEGORIES.UTILITY]: {
    hero: (name) => ({ title:name, subtitle:"Utility-токен", lead:`${name} нужно оценивать через реальную роль токена в продукте, adoption и зависимость спроса на токен от использования.`, main_strength:"Практическая роль токена и потенциал спроса через использование продукта.", main_risk:"Продукт может развиваться без устойчивого спроса на сам токен.", status_text:"Utility-тезис силен, когда adoption прямо усиливает спрос или захват ценности токеном." }),
    executive: (name) => [`${name} оценивается через реальную необходимость токена внутри продукта.`,"Интеграции и adoption важны только если они создают измеримый спрос на токен.","Ликвидность, оценка и концентрация определяют качество рыночного профиля.","Главный вопрос — зависит ли ценность токена от роста использования продукта."],
    profile: { strengths:["Практическая роль токена","Потенциал спроса через продукт","Интеграции и adoption signals","Понятная связь с рыночной задачей"], weaknesses:["Utility может быть необязательной","Adoption продукта не всегда поддерживает токен","Оценка может опережать использование","Ликвидность может быть ограниченной"], risks:["Продуктовый спрос без token demand","Слабая востребованность utility","Концентрация предложения","Переоценка при слабом adoption"], watch:["Использование токена в продукте","Adoption и интеграции","Ликвидность и концентрацию","Связь product demand с token demand"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Utility: реальная роль токена и спрос через продукт", paragraphs:[`${name} должен подтверждать ценность реальной и необходимой ролью токена в продукте.`,"Сильный итоговый тезис возникает, когда adoption создает измеримый спрос на токен, а не только на продукт.","Финальная проверка — выдерживает ли эта связь текущую оценку, ликвидность и концентрационные риски."] }),
  },
  [PROJECT_CATEGORIES.CONSUMER]: {
    hero: (name) => ({ title:name, subtitle:"Consumer-проект", lead:`${name} нужно оценивать через пользователей, продуктовую активность, удержание и связь adoption со спросом на токен.`, main_strength:"Пользовательский продукт и потенциал массового adoption.", main_risk:"Рост аудитории может не превращаться в устойчивую экономику токена.", status_text:"Consumer-тезис подтверждается удержанием пользователей и реальной продуктовой релевантностью." }),
    executive: (name) => [`${name} оценивается через продуктовую релевантность и живую аудиторию.`,"Пользователи и удержание важнее абстрактного нарратива.","Adoption должен создавать устойчивую экономику, связанную с токеном.","Следить нужно за активностью, интеграциями и качеством ликвидности."],
    profile: { strengths:["Пользовательская релевантность","Потенциал массового adoption","Продуктовая активность","Сетевые эффекты аудитории"], weaknesses:["Сложная монетизация аудитории","Token demand может отставать от adoption","Высокая конкуренция за внимание","Зависимость от удержания пользователей"], risks:["Падение активности и retention","Слабая связь продукта с токеном","Смена пользовательских привычек","Недостаточная ликвидность"], watch:["Активных пользователей","Retention и продуктовую активность","Adoption и интеграции","Связь использования со спросом на токен"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Consumer: пользователи, adoption и продуктовая релевантность", paragraphs:[`${name} должен подтверждать оценку живой аудиторией и устойчивым использованием продукта.`,"Главный вопрос — превращается ли adoption в экономику, связанную с токеном.","Сильный итоговый тезис требует удержания пользователей, релевантности продукта и достаточной ликвидности."] }),
  },
});

function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[key], object); }
function supports(definition, capabilities) { return (!definition.capability || capabilities[definition.capability]) && (!definition.anyCapability || definition.anyCapability.some((key) => capabilities[key])); }
function isMetric(metric) { return metric && typeof metric === "object" && ("formatted" in metric || "value" in metric || "status" in metric); }
function isAvailableMetric(metric) { return metric.status !== "unavailable" && (metric.value != null || !["", "—", "данные временно недоступны"].includes(metric.formatted)); }

export function selectHeroKpis(report, project, limit = 6) {
  const profile = getProjectProfile(project);
  const priorities = HERO_KPI_PRIORITIES[profile.category] || HERO_KPI_PRIORITIES[PROJECT_CATEGORIES.UTILITY];
  const supported = priorities.flatMap((key) => {
    const definition = KPI_DEFINITIONS[key];
    const metric = getPath(report, definition.path);
    return supports(definition, profile.capabilities) && isMetric(metric) ? [{ key, label:definition.label, metric }] : [];
  });
  return [...supported.filter(({ metric }) => isAvailableMetric(metric)), ...supported.filter(({ metric }) => !isAvailableMetric(metric))].slice(0, limit);
}

export function applyProfileAwareSemantics(report, project, { preserveCurated = false } = {}) {
  if (!report || !project) return report;
  const profile = getProjectProfile(project);
  const copy = PROFILE_COPY[profile.category] || PROFILE_COPY[PROJECT_CATEGORIES.UTILITY];
  const name = project.name || report.meta?.project_name || project.ticker;
  const ticker = project.ticker || report.meta?.ticker || "TOKEN";

  report.meta = { ...(report.meta || {}), project_profile:profile, semantic_profile:profile.category };
  report.hero = preserveCurated && report.hero ? report.hero : copy.hero(name);
  report.hero.kpis = selectHeroKpis(report, project);
  if (!preserveCurated || !report.executive_summary?.items?.length) report.executive_summary = { items:copy.executive(name) };
  if (!preserveCurated || !report.profile?.strengths?.length) report.profile = structuredClone(copy.profile);
  if (!preserveCurated || !report.final_verdict?.paragraphs?.length) report.final_verdict = copy.verdict(name, ticker);
  if (!preserveCurated && profile.category === PROJECT_CATEGORIES.UTILITY && report.valuation) {
    report.valuation.text = [
      "Оценку utility-токена важно сопоставлять с ликвидностью, оборотом и тем, создает ли использование продукта спрос на токен.",
      "Market Cap / TVL не используется как основной ориентир, если токен не представляет капитал внутри собственного протокола или сети.",
    ];
    if (report.valuation.metrics?.valuation_status) {
      report.valuation.metrics.valuation_status = {
        ...report.valuation.metrics.valuation_status,
        value:null,
        formatted:"—",
        status:"unavailable",
        source:"profile semantics",
      };
    }
  }
  return report;
}
