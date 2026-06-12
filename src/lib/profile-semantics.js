import { PROJECT_CATEGORIES, getProjectProfile } from "../config/projects.js";

const CLOSING_SECTION_ORDER = Object.freeze(["summary", "final_verdict", "narrative_and_news"]);

export const CATEGORY_SECTION_ORDER = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "users_and_activity", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.DEFI]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "users_and_activity", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.MEME]: Object.freeze(["tokenomics", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.UTILITY]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "users_and_activity", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.CONSUMER]: Object.freeze(["users_and_activity", "tokenomics", "financials", ...CLOSING_SECTION_ORDER]),
});

export function getCategorySectionOrder(project) {
  const category = getProjectProfile(project).category;
  return [...(CATEGORY_SECTION_ORDER[category] || CATEGORY_SECTION_ORDER[PROJECT_CATEGORIES.UTILITY])];
}

const KPI_DEFINITIONS = Object.freeze({
  price: { label: "Цена", path: "market.price" },
  market_cap: { label: "Рыночная капитализация", path: "market.market_cap" },
  fdv: { label: "FDV", path: "market.fdv", capability: "hasTokenomics" },
  volume_24h: { label: "Объем 24ч", path: "market.volume_24h" },
  circulating_supply: { label: "В обращении", path: "tokenomics.metrics.circulating_supply", capability: "hasTokenomics", requireValue: true },
  total_supply: { label: "Текущее предложение", path: "tokenomics.metrics.total_supply", capability: "hasTokenomics", requireValue: true },
  max_supply: { label: "Максимальное предложение", path: "tokenomics.metrics.max_supply", capability: "hasTokenomics", requireValue: true },
  net_issuance: { label: "Чистая эмиссия", path: "tokenomics.metrics.net_issuance", capability: "hasTokenomics" },
  burn_mechanism: { label: "Механизм сжигания", path: "tokenomics.metrics.burn_mechanism", capability: "hasTokenomics" },
  market_buyback: { label: "Выкуп с рынка", path: "tokenomics.metrics.market_buyback", capability: "hasTokenomics" },
  tvl: { label: "TVL", path: "capital.metrics.tvl", capability: "hasTvl" },
  stablecoins: { label: "Стейблкоины в сети", path: "capital.metrics.stablecoins_mcap", capability: "hasStablecoins" },
  rwa: { label: "Активные RWA", path: "capital.metrics.rwa_active_mcap", capability: "hasRwa" },
  market_cap_tvl: { label: "Market Cap / TVL", path: "valuation.metrics.market_cap_tvl", capability: "hasTvl" },
  stablecoins_tvl: { label: "Stablecoins / TVL", path: "valuation.metrics.stablecoins_tvl", capability: "hasStablecoins" },
  app_fees: { label: "Комиссии приложений 24ч", path: "financials.metrics.app_fees_24h", capability: "hasProtocolFees" },
  fees: { label: "Сетевые комиссии 24ч", path: "financials.metrics.chain_fees_24h", capability: "hasChainFees" },
  dex_volume: { label: "DEX-оборот 24ч", path: "financials.metrics.dex_volume_24h", capability: "hasDexVolume" },
  trading_quality: { label: "Объем 24ч / капитализация", path: "financials.metrics.volume_market_cap" },
  liquidity: { label: "Ликвидность", path: "semantic_metrics.liquidity", capability: "hasLiquidityData" },
  concentration: { label: "Концентрация держателей", path: "semantic_metrics.concentration", capability: "hasWhaleData" },
  momentum: { label: "Рыночный импульс", path: "semantic_metrics.narrative_momentum", capability: "hasNarrativeMomentum" },
  token_utility: { label: "Роль токена", path: "semantic_metrics.token_utility", capability: "hasTokenUtilityData" },
  adoption: { label: "Использование и интеграции", path: "semantic_metrics.adoption", capability: "hasAdoptionData" },
  users: { label: "Активные пользователи", path: "users.metrics.daily_active_addresses", capability: "hasUsersData" },
});

export const METRIC_SLOT_PRIORITIES = Object.freeze({
  hero: {
    [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "app_fees", "dex_volume", "users"],
    [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "fdv", "tvl", "app_fees", "fees", "dex_volume", "users", "trading_quality", "liquidity"],
    [PROJECT_CATEGORIES.MEME]: ["price", "market_cap", "volume_24h", "trading_quality", "liquidity", "concentration", "momentum"],
    [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply", "token_utility", "liquidity", "adoption", "concentration"],
    [PROJECT_CATEGORIES.CONSUMER]: ["price", "market_cap", "volume_24h", "users", "adoption", "momentum", "liquidity"],
  },
  market: {
    [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality"],
    [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity"],
    [PROJECT_CATEGORIES.MEME]: ["liquidity", "concentration", "momentum"],
    [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity", "token_utility", "adoption"],
    default: ["price", "market_cap", "fdv", "volume_24h", "trading_quality"],
  },
  tokenomics: {
    default: ["market_cap", "fdv", "circulating_supply", "total_supply", "max_supply", "net_issuance", "burn_mechanism", "market_buyback"],
    [PROJECT_CATEGORIES.MEME]: ["market_cap", "fdv", "circulating_supply", "total_supply", "max_supply"],
  },
  financial: {
    [PROJECT_CATEGORIES.INFRA]: ["fees", "app_fees", "dex_volume", "trading_quality"],
    [PROJECT_CATEGORIES.DEFI]: ["app_fees", "fees", "dex_volume", "trading_quality"],
    [PROJECT_CATEGORIES.MEME]: [],
    default: ["trading_quality", "dex_volume", "fees"],
  },
  capital: {
    [PROJECT_CATEGORIES.INFRA]: ["tvl", "stablecoins", "rwa", "stablecoins_tvl", "market_cap_tvl"],
    [PROJECT_CATEGORIES.DEFI]: ["tvl", "stablecoins", "market_cap_tvl", "stablecoins_tvl"],
    default: [],
  },
});

export const HERO_KPI_PRIORITIES = METRIC_SLOT_PRIORITIES.hero;


const CHART_DEFINITIONS = Object.freeze({
  price_history: { label:"Цена", path:"charts.price_history" },
  volume_history: { label:"Объем торгов", path:"charts.volume_history" },
  market_cap_history: { label:"Рыночная капитализация", path:"charts.market_cap_history" },
  app_fees_history: { label:"App Fees", path:"charts.app_fees_history", capability:"hasProtocolFees" },
  chain_fees_history: { label:"Chain Fees", path:"charts.chain_fees_history", capability:"hasChainFees" },
  dex_history: { label:"DEX-оборот", path:"charts.dex_history", capability:"hasDexVolume" },
  tvl_history: { label:"TVL", path:"charts.tvl_history", capability:"hasTvl" },
  stablecoins_history: { label:"Stablecoins", path:"charts.stablecoins_history", capability:"hasStablecoins" },
});

export const CHART_PACK_PRIORITIES = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: ["price_history", "chain_fees_history", "app_fees_history", "dex_history", "tvl_history", "stablecoins_history"],
  [PROJECT_CATEGORIES.DEFI]: ["price_history", "app_fees_history", "chain_fees_history", "dex_history", "tvl_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.MEME]: ["price_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.UTILITY]: ["price_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.CONSUMER]: ["price_history", "volume_history", "market_cap_history"],
});

const PROFILE_COPY = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: {
    hero: (name) => ({ title:name, subtitle:"Инфраструктурный актив", lead:`${name} оценивается через капитал сети, спрос на блокспейс и способность базового актива удерживать ценность.`, main_strength:"Капитал и использование экосистемы поддерживают спрос на базовый актив.", main_risk:"Создаваемая ценность может уходить приложениям или другим слоям.", status_text:"Фокус: динамика капитала, комиссий и активных пользователей." }),
    executive: () => ["Проверить устойчивость капитала, а не только его текущий объем.", "Сопоставить комиссии и активность с оценкой актива.", "Понять, какая часть экономики сети остается у токена."],
    profile: { strengths:["Глубокий рынок базового актива","Капитал внутри экосистемы"], weaknesses:["Ценность распределяется между слоями","Высокая оценка повышает требования к росту"], risks:["Устойчивый отток капитала","Падение спроса на блокспейс"], watch:["TVL и стейблкоины в динамике","Комиссии и активных пользователей"] },
    verdict: (name, ticker) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: сеть должна удерживать капитал и ценность", paragraphs:[`${name} остается убедительным, пока рост капитала и использования переходит в спрос на базовый актив; главный риск — разрыв между экономикой сети и оценкой токена.`] }),
    conclusions: { tokenomics:"Предложение важно оценивать через давление выпуска и спрос на базовый актив сети.", financials:"Комиссии полезны как проверка платного спроса на сеть.", capital:"Динамика TVL и стейблкоинов показывает, удерживает ли сеть капитал.", liquidity:"Глубокий рынок облегчает управление позицией, но не заменяет сетевую экономику.", narrative:"Новости значимы, когда меняют капитал, использование или захват ценности." },
  },
  [PROJECT_CATEGORIES.DEFI]: {
    hero: (name) => ({ title:name, subtitle:"DeFi-протокол", lead:`${name} оценивается как финансовый продукт: через устойчивый спрос, доход и пользу токена.`, main_strength:"Повторяемое использование и комиссионная экономика.", main_risk:"Продукт может расти без выгоды для токена.", status_text:"Фокус: качество TVL, доход и захват ценности токеном." }),
    executive: () => ["Отделить устойчивый TVL от капитала, привлеченного стимулами.", "Проверить повторяемость комиссий и дохода.", "Понять, получает ли токен выгоду от роста продукта."],
    profile: { strengths:["Повторяемое использование продукта","Измеримая комиссионная экономика"], weaknesses:["TVL может зависеть от стимулов","Доход протокола не всегда достается токену"], risks:["Отток ликвидности после снижения наград","Ослабление захвата ценности токеном"], watch:["Устойчивость TVL без стимулов","Доход и механизм его передачи токену"] },
    verdict: (name, ticker) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: продуктовая экономика должна работать на токен", paragraphs:[`${name} интересен при устойчивом использовании и понятном захвате ценности токеном; главный риск — рост продукта без измеримой выгоды для держателя.`] }),
    conclusions: { tokenomics:"Структура предложения вторична без понятного механизма захвата продуктовой ценности.", financials:"Устойчивые комиссии и доход важнее краткого всплеска активности.", capital:"Качественный TVL удерживается продуктом, а не только вознаграждениями.", liquidity:"Ликвидность определяет устойчивость продукта при выходе капитала.", narrative:"Продуктовые метрики должны подтверждать нарратив быстрее, чем растет оценка." },
  },
  [PROJECT_CATEGORIES.MEME]: {
    hero: (name) => ({ title:name, subtitle:"Meme-актив", lead:`${name} оценивается через ликвидность, оборот и устойчивость рыночного внимания.`, main_strength:"Узнаваемость помогает концентрировать оборот.", main_risk:"Внимание и глубина рынка могут снизиться одновременно.", status_text:"Фокус: оборот к капитализации, глубина выхода и концентрация." }),
    executive: () => ["Сравнить оборот с капитализацией и размером позиции.", "Проверить, сохраняется ли глубина рынка при снижении цены.", "Оценить концентрацию держателей и устойчивость внимания."],
    profile: { strengths:["Узнаваемый рыночный образ","Способность собирать торговый оборот"], weaknesses:["Нет фундаментального денежного потока","Спрос зависит от рыночного внимания"], risks:["Крупные продажи в тонком рынке","Быстрая потеря торгового интереса"], watch:["Оборот к капитализации","Глубину рынка и концентрацию держателей"] },
    verdict: (name, ticker) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: ликвидность должна переживать смену внимания", paragraphs:[`${name} остается торговым тезисом, пока оборот обеспечивает реальный выход из позиции; главный риск — одновременная потеря внимания и ликвидности.`] }),
    conclusions: { tokenomics:"Для meme-актива важнее распределение предложения, чем сложность токеномики.", financials:"Оборот показывает силу рынка, но не создает фундаментальный доход.", capital:"Капитал здесь подвижен и зависит от внимания и ликвидности.", liquidity:"Глубина рынка определяет, можно ли выйти из позиции без сильного проскальзывания.", narrative:"Устойчивость внимания важнее единичного новостного всплеска." },
  },
  [PROJECT_CATEGORIES.UTILITY]: {
    hero: (name) => ({ title:name, subtitle:"Utility-токен", lead:`${name} оценивается через необходимость токена в продукте и реальный спрос на него.`, main_strength:"Токен нужен для работающего продукта.", main_risk:"Продукт может развиваться без спроса на токен.", status_text:"Фокус: обязательность токена, использование и ликвидность." }),
    executive: () => ["Проверить, обязателен ли токен для продукта.", "Связать рост использования с измеримым спросом на токен.", "Сопоставить эту связь с оценкой и ликвидностью."],
    profile: { strengths:["Понятная роль токена в продукте","Рост использования способен создавать спрос"], weaknesses:["Токен может оказаться необязательным","Ликвидность может быть ограниченной"], risks:["Продукт растет без спроса на токен","Оценка опережает реальное использование"], watch:["Необходимость токена в продукте","Связь использования со спросом на токен"] },
    verdict: (name, ticker) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: использование продукта должно создавать спрос на токен", paragraphs:[`${name} убедителен при измеримой связи продукта со спросом на токен; главный риск — рост использования без выгоды для держателя.`] }),
    conclusions: { tokenomics:"Предложение имеет смысл оценивать вместе с реальной потребностью в токене.", financials:"Экономика продукта важна лишь в той мере, в какой поддерживает спрос на токен.", capital:"Капитал подтверждает полезность только при связи с использованием продукта.", liquidity:"Достаточная ликвидность снижает риск выхода из позиции.", narrative:"Интеграции ценны, когда превращаются в измеримое использование токена." },
  },
  [PROJECT_CATEGORIES.CONSUMER]: {
    hero: (name) => ({ title:name, subtitle:"Пользовательский проект", lead:`${name} оценивается через удержание аудитории и связь продукта с токеном.`, main_strength:"Повторяемое использование и потенциал сетевого эффекта.", main_risk:"Рост аудитории может не поддержать экономику токена.", status_text:"Фокус: удержание, повторное использование и монетизация." }),
    executive: () => ["Отделить удержание аудитории от разового охвата.", "Проверить повторяемость использования и монетизации.", "Понять, создает ли продукт спрос на токен."],
    profile: { strengths:["Пользовательская релевантность","Потенциал сетевого эффекта"], weaknesses:["Сложная монетизация аудитории","Спрос на токен может отставать от роста продукта"], risks:["Падение удержания пользователей","Слабая связь продукта с токеном"], watch:["Активных и возвращающихся пользователей","Связь использования со спросом на токен"] },
    verdict: (name, ticker) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: удержание должно переходить в экономику токена", paragraphs:[`${name} убедителен при устойчивом удержании и понятной связи продукта с токеном; главный риск — аудитория без монетизации и спроса на актив.`] }),
    conclusions: { tokenomics:"Токеномика работает, если поддерживает продукт, а не заменяет его.", financials:"Повторяемая монетизация важнее роста аудитории без дохода.", capital:"Капитал устойчив, когда следует за удержанием пользователей.", liquidity:"Ликвидность снижает риск позиции, но не компенсирует слабое удержание.", narrative:"Внимание ценно только при переходе в повторяемое использование." },
  },
});

const PROJECT_COPY = Object.freeze({
  eth: {
    executive:["Проверить, удерживает ли Ethereum расчетный капитал между L1, L2 и приложениями.", "Сопоставить комиссионный спрос и активность с оценкой ETH.", "Следить за выпуском и сжиганием как итогом спроса на блокспейс."],
    profile:{ strengths:["Крупнейший расчетный капитал экосистемы","Глубокий рынок базового актива"], weaknesses:["Ценность распределяется между L1, L2 и приложениями","Зрелая оценка требует сильной экономики"], risks:["Ослабление спроса на блокспейс","Уход захвата ценности в другие слои"], watch:["Комиссии и чистую эмиссию","Капитал и активность между L1 и L2"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: расчетный капитал должен создавать спрос на ETH", paragraphs:["ETH сохраняет сильную инфраструктурную позицию, пока расчетный капитал и безопасность поддерживают спрос на актив; главный риск — уход создаваемой ценности в L2 и приложения."]},
    conclusions:{ tokenomics:"Баланс выпуска и сжигания показывает итоговый спрос на блокспейс Ethereum.", financials:"Комиссии проверяют платный спрос на расчетный слой Ethereum.", capital:"Динамика TVL и стейблкоинов показывает устойчивость расчетного капитала.", liquidity:"Глубокий рынок упрощает управление позицией, но не решает вопрос захвата ценности.", narrative:"Обновления сети значимы, если усиливают использование и спрос на ETH."},
  },
  sol: {
    executive:["Проверить, удерживается ли быстро привлеченный капитал в Solana.", "Отделить устойчивые комиссии и оборот от краткосрочного всплеска активности.", "Оценить, какая часть экономики приложений создает спрос на SOL."],
    profile:{ strengths:["Быстрый рост капитала и внутрисетевого оборота","Высокая пропускная способность для приложений"], weaknesses:["Качество активности неоднородно","Ценность распределяется между приложениями и базовым слоем"], risks:["Охлаждение торговой активности","Отток быстро привлеченного капитала"], watch:["Удержание TVL и стейблкоинов","Комиссии и глубину внутрисетевого оборота"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: быстрый рост должен стать устойчивым спросом на SOL", paragraphs:["SOL выглядит убедительно, пока экосистема удерживает капитал и создает повторяемые комиссии; главный риск — быстрое охлаждение активности после смены цикла."]},
    conclusions:{ tokenomics:"Спрос на SOL должен перекрывать давление предложения по мере роста сети.", financials:"Качество комиссий важнее рекордного числа дешевых операций.", capital:"Удержание TVL и стейблкоинов покажет, переживает ли рост Solana смену цикла.", liquidity:"Сильный оборот полезен, пока рынок сохраняет глубину при выходе капитала.", narrative:"Темп роста значим, если превращается в устойчивую экономику базового слоя."},
  },
  doge: {
    executive:["Сопоставить узнаваемость DOGE с реальным торговым оборотом.", "Проверить глубину выхода для планируемого размера позиции.", "Следить за концентрацией и устойчивостью внимания между циклами."],
    profile:{ strengths:["Самый узнаваемый meme-актив","Глубокий и давно работающий рынок"], weaknesses:["Нет фундаментального денежного потока","Предложение продолжает расти"], risks:["Длительное снижение торгового интереса","Крупные продажи при ослаблении глубины рынка"], watch:["Оборот к капитализации","Глубину рынка в периоды снижения"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: зрелая ликвидность должна переживать смену цикла", paragraphs:["DOGE поддерживает позицию узнаваемостью и глубиной рынка; главный риск — затяжное снижение внимания, при котором ликвидность перестает компенсировать отсутствие денежного потока."]},
  },
  pepe: {
    executive:["Проверить, поддерживает ли импульс достаточный оборот для выхода.", "Следить за глубиной рынка при первых признаках снижения внимания.", "Оценить риск крупных продаж и концентрацию предложения."],
    profile:{ strengths:["Сильный рыночный образ внутри meme-сегмента","Способность быстро собирать торговый оборот"], weaknesses:["Спрос почти полностью зависит от внимания","История актива еще не проверена несколькими циклами"], risks:["Резкое падение глубины рынка после потери импульса","Продажи крупных держателей"], watch:["Оборот и глубину рынка одновременно","Концентрацию и продолжительность импульса"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: импульс должен сохранять ликвидный выход", paragraphs:["PEPE остается сильным торговым тезисом, пока внимание поддерживает оборот и глубину рынка; главный риск — резкое исчезновение ликвидного выхода после потери импульса."]},
  },
});

function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[key], object); }
function supports(definition, capabilities) { return (!definition.capability || capabilities[definition.capability]) && (!definition.anyCapability || definition.anyCapability.some((key) => capabilities[key])); }
function isMetric(metric) { return metric && typeof metric === "object" && ("formatted" in metric || "value" in metric || "status" in metric); }

const EMPTY_METRIC_FORMATS = new Set(["", "—", "-", "n/a", "na", "unknown", "данные временно недоступны", "источник подключается"]);

export function isAvailableMetric(metric, { requireValue = false } = {}) {
  if (!isMetric(metric) || metric.status === "unavailable" || metric.status === "unknown") return false;
  if (metric.value !== null && metric.value !== undefined && !(typeof metric.value === "number" && !Number.isFinite(metric.value))) return true;
  if (requireValue) return false;
  const formatted = String(metric.formatted ?? "").trim().toLowerCase();
  return Boolean(formatted) && !EMPTY_METRIC_FORMATS.has(formatted) && !formatted.includes("временно недоступ") && !formatted.includes("unknown");
}

function prioritiesFor(slot, category) {
  const priorities = METRIC_SLOT_PRIORITIES[slot] || {};
  return priorities[category] || priorities.default || [];
}

export function selectMetricSlots(report, project, slot, limit = Infinity) {
  const profile = getProjectProfile(project);
  return prioritiesFor(slot, profile.category).flatMap((key) => {
    const definition = KPI_DEFINITIONS[key];
    const metric = definition ? getPath(report, definition.path) : null;
    return definition && supports(definition, profile.capabilities) && isAvailableMetric(metric, definition)
      ? [{ key, label:definition.label, metric }]
      : [];
  }).slice(0, limit);
}

export function selectHeroKpis(report, project, limit = 6) {
  return selectMetricSlots(report, project, "hero", limit);
}

export function selectChartSlots(report, project) {
  const profile = getProjectProfile(project);
  return (CHART_PACK_PRIORITIES[profile.category] || CHART_PACK_PRIORITIES[PROJECT_CATEGORIES.UTILITY]).flatMap((key) => {
    const definition = CHART_DEFINITIONS[key];
    const series = definition ? getPath(report, definition.path) : null;
    return definition && supports(definition, profile.capabilities) && Array.isArray(series) && series.length > 1
      ? [{ key, label:definition.label }]
      : [];
  });
}

export function selectReportMetricSlots(report, project) {
  const profile = getProjectProfile(project);
  const usedKeys = new Set(selectHeroKpis(report, project).map(({ key }) => key));
  const allocate = (slot, limit) => {
    const selected = selectMetricSlots(report, project, slot, limit).filter(({ key }) => !usedKeys.has(key));
    selected.forEach(({ key }) => usedKeys.add(key));
    return selected;
  };

  return {
    market: allocate("market", 8),
    tokenomics: allocate("tokenomics", 8),
    financial: allocate("financial", 3),
    capital: allocate("capital", 5).slice(0, 3),
  };
}

export function applyProfileAwareSemantics(report, project, { preserveCurated = false } = {}) {
  if (!report || !project) return report;
  const profile = getProjectProfile(project);
  const copy = PROFILE_COPY[profile.category] || PROFILE_COPY[PROJECT_CATEGORIES.UTILITY];
  const projectCopy = PROJECT_COPY[project.slug] || {};
  const name = project.name || report.meta?.project_name || project.ticker;
  const ticker = project.ticker || report.meta?.ticker || "TOKEN";
  const useGeneratedCopy = !preserveCurated;

  report.meta = { ...(report.meta || {}), project_profile:profile, semantic_profile:profile.category, section_order:getCategorySectionOrder(project) };
  report.hero = preserveCurated && report.hero ? report.hero : copy.hero(name);
  report.hero.kpis = selectHeroKpis(report, project);
  report.metric_slots = selectReportMetricSlots(report, project);
  report.chart_slots = selectChartSlots(report, project);
  if (useGeneratedCopy || !report.executive_summary?.items?.length) report.executive_summary = { items:structuredClone(projectCopy.executive || copy.executive(name)) };
  if (useGeneratedCopy || !report.profile?.strengths?.length) report.profile = structuredClone(projectCopy.profile || copy.profile);
  if (useGeneratedCopy || !report.final_verdict?.paragraphs?.length) report.final_verdict = structuredClone(projectCopy.verdict || copy.verdict(name, ticker));
  for (const [block, conclusion] of Object.entries({ ...(copy.conclusions || {}), ...(projectCopy.conclusions || {}) })) {
    if (report[block]) report[block].conclusion = conclusion;
  }
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
