import { ANALYSIS_PROFILES, PROJECT_CATEGORIES, getProjectProfile } from "../config/projects.js";

const CLOSING_SECTION_ORDER = Object.freeze(["summary", "final_verdict", "narrative_and_news"]);

export const CATEGORY_SECTION_ORDER = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "users_and_activity", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.MACRO]: Object.freeze(["tokenomics", "demand_and_flows", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.DEFI]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "users_and_activity", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.MEME]: Object.freeze(["tokenomics", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.UTILITY]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "users_and_activity", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.CONSUMER]: Object.freeze(["users_and_activity", "tokenomics", "financials", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", "utility_and_adoption", ...CLOSING_SECTION_ORDER]),
  [PROJECT_CATEGORIES.TRADING_VENUE]: Object.freeze(["tokenomics", "financials", "tvl_and_capital", ...CLOSING_SECTION_ORDER]),
});

export function getCategorySectionOrder(project) {
  const profile = getProjectProfile(project);
  if (profile.analysisProfile === ANALYSIS_PROFILES.PRODUCT_DEFI_ECONOMICS) {
    return ["tokenomics", "financials", "tvl_and_capital", ...CLOSING_SECTION_ORDER];
  }
  if (profile.analysisProfile === ANALYSIS_PROFILES.ORACLE_UTILITY) {
    return ["tokenomics", "utility_and_adoption", ...CLOSING_SECTION_ORDER];
  }
  return [...(CATEGORY_SECTION_ORDER[profile.category] || CATEGORY_SECTION_ORDER[PROJECT_CATEGORIES.UTILITY])];
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
  burn_target: { label: "Целевое предложение после burn", path: "tokenomics.metrics.burn_target", capability: "hasTokenomics" },
  market_buyback: { label: "Выкуп с рынка", path: "tokenomics.metrics.market_buyback", capability: "hasTokenomics" },
  value_capture: { label: "Value capture", path: "semantic_metrics.value_capture", capability: "hasValueCaptureData" },
  annualized_app_fees_market_cap: { label: "Annualized Fees / Market Cap", path: "valuation.metrics.annualized_app_fees_market_cap", capability: "hasProtocolFees" },
  dex_volume_market_cap: { label: "DEX Volume / Market Cap", path: "valuation.metrics.dex_volume_market_cap", capability: "hasDexVolume" },
  tvl: { label: "TVL", path: "capital.metrics.tvl", capability: "hasTvl" },
  stablecoins: { label: "Стейблкоины в сети", path: "capital.metrics.stablecoins_mcap", capability: "hasStablecoins" },
  rwa: { label: "Активные RWA", path: "capital.metrics.rwa_active_mcap", capability: "hasRwa" },
  market_cap_tvl: { label: "Market Cap / TVL", path: "valuation.metrics.market_cap_tvl", capability: "hasTvl" },
  stablecoins_tvl: { label: "Stablecoins / TVL", path: "valuation.metrics.stablecoins_tvl", capability: "hasStablecoins" },
  annualized_chain_fees_market_cap: { label: "Annualized Chain Fees / Market Cap", path: "valuation.metrics.annualized_chain_fees_market_cap", capability: "hasChainFees" },
  app_fees: { label: "Комиссии приложений 24ч", path: "financials.metrics.app_fees_24h", capability: "hasProtocolFees" },
  protocol_fees: { label: "Комиссии протокола 24ч", path: "financials.metrics.app_fees_24h", capability: "hasProtocolFees" },
  fees: { label: "Сетевые комиссии 24ч", path: "financials.metrics.chain_fees_24h", capability: "hasChainFees" },
  dex_volume: { label: "DEX-оборот 24ч", path: "financials.metrics.dex_volume_24h", capability: "hasDexVolume" },
  trading_quality: { label: "Объем 24ч / капитализация", path: "financials.metrics.volume_market_cap" },
  liquidity: { label: "Ликвидность", path: "semantic_metrics.liquidity", capability: "hasLiquidityData" },
  concentration: { label: "Концентрация держателей", path: "semantic_metrics.concentration", capability: "hasWhaleData" },
  momentum: { label: "Рыночный импульс", path: "semantic_metrics.narrative_momentum", capability: "hasNarrativeMomentum" },
  token_utility: { label: "Роль токена", path: "semantic_metrics.token_utility", capability: "hasTokenUtilityData" },
  adoption: { label: "Использование и интеграции", path: "semantic_metrics.adoption", capability: "hasAdoptionData" },
  protocol_usage: { label: "Использование протокола", path: "semantic_metrics.protocol_usage", capability: "hasAdoptionData" },
  emission_pressure: { label: "Давление эмиссии", path: "semantic_metrics.emission_pressure", capability: "hasUnlocks" },
  governance_role: { label: "Роль governance", path: "semantic_metrics.governance_role", capability: "hasTokenUtilityData" },
  exchange_utility: { label: "Utility в Binance", path: "semantic_metrics.exchange_utility", capability: "hasTokenUtilityData" },
  users: { label: "Активные пользователи", path: "users.metrics.daily_active_addresses", capability: "hasUsersData" },
  mvrv: { label: "MVRV", path: "valuation.metrics.mvrv", capability: "hasBtcValuationData" },
  realized_price: { label: "Realized Price", path: "valuation.metrics.realized_price", capability: "hasBtcValuationData" },
  nupl: { label: "NUPL", path: "valuation.metrics.nupl", capability: "hasBtcValuationData" },
  btc_dominance: { label: "BTC Dominance", path: "demand_flows.metrics.btc_dominance", capability: "hasDemandFlowData" },
  circulating_share: { label: "В обращении от 21M", path: "tokenomics.metrics.circulating_share", capability: "hasBtcValuationData" },
  issuance_rate: { label: "Годовой темп эмиссии", path: "tokenomics.metrics.issuance_rate", capability: "hasBtcValuationData" },
});

export const METRIC_SLOT_PRIORITIES = Object.freeze({
  hero: {
    [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "app_fees", "dex_volume", "users"],
    [PROJECT_CATEGORIES.MACRO]: ["price", "market_cap", "fdv", "volume_24h", "mvrv", "realized_price", "btc_dominance", "trading_quality", "circulating_supply", "circulating_share", "max_supply"],
    [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "fdv", "tvl", "app_fees", "fees", "dex_volume", "users", "trading_quality", "liquidity"],
    [PROJECT_CATEGORIES.MEME]: ["price", "market_cap", "volume_24h", "trading_quality", "liquidity", "concentration", "momentum"],
    [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply", "token_utility", "liquidity", "adoption", "concentration"],
    [PROJECT_CATEGORIES.CONSUMER]: ["price", "market_cap", "volume_24h", "users", "adoption", "momentum", "liquidity"],
    [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: ["price", "market_cap", "volume_24h", "burn_mechanism", "exchange_utility", "tvl", "stablecoins", "fees", "dex_volume", "fdv"],
    [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "dex_volume", "token_utility", "adoption"],
    [PROJECT_CATEGORIES.TRADING_VENUE]: ["price", "market_cap", "fdv", "volume_24h", "protocol_fees", "dex_volume", "value_capture", "market_buyback", "annualized_app_fees_market_cap", "dex_volume_market_cap", "trading_quality"],
  },
  market: {
    [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality"],
    [PROJECT_CATEGORIES.MACRO]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply", "max_supply", "liquidity"],
    [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity"],
    [PROJECT_CATEGORIES.MEME]: ["liquidity", "concentration", "momentum"],
    [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity", "token_utility", "adoption"],
    [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity", "exchange_utility"],
    [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity", "token_utility", "adoption"],
    [PROJECT_CATEGORIES.TRADING_VENUE]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity"],
    default: ["price", "market_cap", "fdv", "volume_24h", "trading_quality"],
  },
  tokenomics: {
    default: ["market_cap", "fdv", "circulating_supply", "total_supply", "max_supply", "net_issuance", "burn_mechanism", "burn_target", "market_buyback"],
    [PROJECT_CATEGORIES.MEME]: ["market_cap", "fdv", "circulating_supply", "total_supply", "max_supply"],
    [PROJECT_CATEGORIES.MACRO]: ["circulating_supply", "max_supply", "circulating_share", "issuance_rate", "market_cap", "fdv"],
    [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: ["burn_mechanism", "burn_target", "circulating_supply", "total_supply", "max_supply", "market_cap", "fdv"],
    [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: ["circulating_supply", "total_supply", "max_supply", "market_cap", "fdv", "token_utility"],
    [PROJECT_CATEGORIES.TRADING_VENUE]: ["value_capture", "market_buyback", "circulating_supply", "total_supply", "max_supply", "market_cap", "fdv"],
  },
  financial: {
    [PROJECT_CATEGORIES.INFRA]: ["fees", "app_fees", "dex_volume", "trading_quality"],
    [PROJECT_CATEGORIES.DEFI]: ["app_fees", "fees", "dex_volume", "trading_quality"],
    [PROJECT_CATEGORIES.MEME]: [],
    [PROJECT_CATEGORIES.MACRO]: ["trading_quality"],
    [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: ["fees", "annualized_chain_fees_market_cap", "dex_volume", "trading_quality"],
    [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: ["fees", "annualized_chain_fees_market_cap", "dex_volume", "trading_quality"],
    [PROJECT_CATEGORIES.TRADING_VENUE]: ["protocol_fees", "dex_volume", "annualized_app_fees_market_cap", "dex_volume_market_cap", "trading_quality"],
    default: ["trading_quality", "dex_volume", "fees"],
  },
  capital: {
    [PROJECT_CATEGORIES.INFRA]: ["tvl", "stablecoins", "rwa", "stablecoins_tvl", "market_cap_tvl"],
    [PROJECT_CATEGORIES.DEFI]: ["tvl", "stablecoins", "market_cap_tvl", "stablecoins_tvl"],
    [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: ["tvl", "stablecoins", "market_cap_tvl", "stablecoins_tvl"],
    [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: ["tvl", "stablecoins", "market_cap_tvl", "stablecoins_tvl"],
    [PROJECT_CATEGORIES.TRADING_VENUE]: ["tvl", "stablecoins", "market_cap_tvl", "stablecoins_tvl"],
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
  mvrv_history: { label:"MVRV", path:"charts.mvrv_history", capability:"hasBtcValuationData" },
  realized_price_history: { label:"Realized Price vs Market Price", path:"charts.realized_price_history", capability:"hasBtcValuationData" },
  issuance_history: { label:"Годовой темп эмиссии", path:"charts.issuance_history", capability:"hasBtcValuationData" },
  btc_etf_flow_history: { label:"Spot BTC ETF Net Flow", path:"charts.btc_etf_flow_history", capability:"hasDemandFlowData" },
  btc_etf_cumulative_history: { label:"Spot BTC ETF Cumulative Flow", path:"charts.btc_etf_cumulative_history", capability:"hasDemandFlowData" },
});

export const CHART_PACK_PRIORITIES = Object.freeze({
  [PROJECT_CATEGORIES.INFRA]: ["price_history", "chain_fees_history", "app_fees_history", "dex_history", "tvl_history", "stablecoins_history"],
  [PROJECT_CATEGORIES.MACRO]: ["price_history", "mvrv_history", "realized_price_history", "btc_etf_flow_history", "btc_etf_cumulative_history", "issuance_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.DEFI]: ["price_history", "app_fees_history", "chain_fees_history", "dex_history", "tvl_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.MEME]: ["price_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.UTILITY]: ["price_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.CONSUMER]: ["price_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: ["price_history", "chain_fees_history", "dex_history", "tvl_history", "stablecoins_history", "volume_history"],
  [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: ["price_history", "chain_fees_history", "dex_history", "tvl_history", "stablecoins_history", "volume_history", "market_cap_history"],
  [PROJECT_CATEGORIES.TRADING_VENUE]: ["price_history", "app_fees_history", "dex_history", "volume_history", "market_cap_history", "tvl_history"],
});

const PROFILE_COPY = Object.freeze({
  [PROJECT_CATEGORIES.MACRO]: {
    hero: (name) => ({ title:name, subtitle:"Крупный макро-актив", lead:`${name} оценивается через рыночную роль, глубину ликвидности, устойчивость спроса и дефицит предложения.`, main_strength:"Глобальная ликвидность и устоявшаяся роль независимого денежного актива.", main_risk:"Высокая чувствительность оценки к рыночному циклу, ставкам и потокам капитала.", status_text:"Фокус: структура рынка, оборот, предложение и институциональный спрос." }),
    executive: () => ["Проверить устойчивость спроса и ликвидности на разных фазах цикла.", "Сопоставить текущую оценку с оборотом и ограниченным предложением.", "Следить за институциональными потоками и макроусловиями, меняющими спрос."],
    profile: { strengths:["Самая глубокая ликвидность среди криптоактивов","Ограниченное и предсказуемое максимальное предложение"], weaknesses:["Нет денежного потока для классической фундаментальной оценки","Спрос и оценка чувствительны к глобальному циклу ликвидности"], risks:["Резкое сокращение рыночной ликвидности","Снижение институционального и долгосрочного спроса","Регуляторные ограничения на доступ к рынку"], watch:["Оборот и глубину рынка","Динамику предложения и долгосрочного спроса","Институциональные потоки и макрофон"] },
    verdict: (name) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: денежная роль и ликвидность должны переживать смену цикла", paragraphs:[`${name} остается сильным макро-активом, пока ограниченное предложение сочетается с глубокой ликвидностью и устойчивым глобальным спросом; главный риск — переоценка на пике рыночного цикла.`] }),
    conclusions: { tokenomics:"Ограниченное предложение — центральная часть тезиса, но его ценность подтверждается только устойчивым спросом.", liquidity:"Глубина рынка и оборот определяют качество BTC как крупного ликвидного актива.", narrative:"Новости значимы, когда меняют институциональный спрос, доступ к рынку или макроусловия.", valuation:"Оценку BTC следует рассматривать через рыночный цикл, ликвидность и устойчивость спроса, а не через TVL или DeFi-мультипликаторы." },
  },
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
  [PROJECT_CATEGORIES.ECOSYSTEM_GROWTH]: {
    hero: (name) => ({ title:name, subtitle:"Infra / ecosystem-growth asset", lead:`${name} оценивается через рост капитала и использования экосистемы, ликвидность и то, превращается ли этот рост в спрос на токен.`, main_strength:"Рост экосистемы способен расширять спрос на инфраструктуру и токен.", main_risk:"Капитал, usage или сильный нарратив могут не передавать ценность токену.", status_text:"Фокус: ecosystem growth → capital / usage → token demand → valuation." }),
    executive: () => ["Проверить рост TVL, расчетной ликвидности и сетевой активности.", "Сопоставить капитализацию и FDV с реальной экономикой экосистемы.", "Понять, создает ли рост сети устойчивый спрос на токен."],
    profile: { strengths:["Инфраструктурная роль и потенциал экосистемного роста","Измеримые сигналы капитала, ликвидности и использования"], weaknesses:["Связь роста экосистемы со спросом на токен может быть неполной","Оценка способна опережать сетевую экономику"], risks:["Отток капитала и ликвидности","Слабый token value capture при росте экосистемы","Нарратив опережает комиссии и использование"], watch:["TVL, стейблкоины и DEX-ликвидность","Комиссии и устойчивость usage","Market Cap / TVL и связь токена с ростом сети"] },
    verdict: (name) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: рост экосистемы должен превращаться в спрос на токен", paragraphs:[`${name} убедителен, пока капитал, ликвидность и использование экосистемы растут вместе со спросом на токен; главный риск — оценка или нарратив, опережающие реальную сетевую экономику.`] }),
    conclusions: { tokenomics:"Supply-профиль нужно сопоставлять с ролью токена и реальным экосистемным спросом.", financials:"Комиссии и DEX-оборот проверяют, есть ли за ростом экосистемы платное использование.", capital:"TVL и стейблкоины показывают глубину капитала и расчетной ликвидности внутри экосистемы.", liquidity:"Ликвидность токена и on-chain капитала снижает риск, но не доказывает value capture.", utility_adoption:"Adoption значим только там, где подтверждается usage, капиталом или устойчивым спросом.", narrative:"Релевантны события, меняющие инфраструктуру, adoption, капитал или связь роста сети с токеном." },
  },
  [PROJECT_CATEGORIES.HYBRID_ECOSYSTEM]: {
    hero: (name) => ({ title:name, subtitle:"Hybrid: биржевая utility + BNB Chain", lead:`${name} оценивается через совокупный спрос внутри Binance, роль газа и базового актива BNB Chain, а также устойчивое сокращение предложения.`, main_strength:"Несколько источников utility: биржевая экосистема, on-chain использование и burn-механика.", main_risk:"Спрос и оценка заметно зависят от Binance, регулирования и способности экосистемы передавать ценность токену.", status_text:"Фокус: utility Binance, burn, капитал BNB Chain и устойчивость совокупного спроса." }),
    executive: () => ["Разделить спрос на BNB со стороны Binance ecosystem и использование токена внутри BNB Chain.", "Проверить, поддерживают ли burn и сокращение предложения долгосрочную ценность, не подменяя реальный спрос.", "Сопоставить оценку с капиталом, комиссиями и торговой активностью BNB Chain, учитывая регуляторную зависимость от Binance."],
    profile: { strengths:["Многослойная utility в Binance и BNB Chain","Burn-механика поддерживает тезис сокращения предложения"], weaknesses:["Высокая зависимость от одной экосистемы","Не вся ценность Binance и BNB Chain автоматически достается BNB"], risks:["Регуляторное или операционное давление на Binance","Ослабление utility, burn или активности BNB Chain"], watch:["Темп burn и динамику предложения","Спрос внутри Binance и капитал BNB Chain"] },
    verdict: (name) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: utility, burn и chain-слой должны поддерживать друг друга", paragraphs:[`${name} остается сильным hybrid-активом, пока utility внутри Binance, использование BNB Chain и сокращение предложения вместе создают устойчивый спрос; главный риск — зависимость этой связки от Binance и регулирования.`] }),
    conclusions: { tokenomics:"BNB получает поддержку от Auto-Burn и сжигания части gas fees, но сокращение предложения важно оценивать вместе с реальным спросом в Binance и BNB Chain.", financials:"Комиссии, Annualized Chain Fees / Market Cap, DEX-оборот и Volume / Market Cap связывают измеримый спрос с оценкой BNB, но не измеряют всю экономику Binance ecosystem.", capital:"TVL, Market Cap / TVL и Stablecoins / TVL показывают масштаб капитала и расчетной ликвидности BNB Chain как важный, но не единственный слой спроса на BNB.", valuation:"Оценка BNB сильнее, когда utility Binance и burn подтверждаются оборотом, платным on-chain спросом и устойчивым капиталом BNB Chain.", liquidity:"Биржевая ликвидность поддерживает доступность BNB, одновременно усиливая зависимость от Binance ecosystem.", narrative:"Для BNB релевантны новости о burn, utility, Binance ecosystem, BNB Chain и регулировании, способном изменить спрос на токен." },
  },
  [PROJECT_CATEGORIES.TRADING_VENUE]: {
    hero: (name) => ({ title:name, subtitle:"Trading venue / revenue-driven growth asset", lead:`${name} оценивается как торговый продукт: объемы и комиссии должны расти, а value capture — связывать успех площадки с токеном.`, main_strength:"Реальный продуктовый спрос может создавать повторяемую комиссионную экономику и поддержку токена.", main_risk:"Рыночная оценка может обогнать устойчивые объемы, комиссии и фактический value capture.", status_text:"Фокус: trading activity → fees → token value capture → valuation." }),
    executive: () => ["Проверить, держатся ли объемы и комиссии на повторяемом продуктовом спросе.", "Сопоставить капитализацию и FDV с комиссионной экономикой торговой площадки.", "Проверить, насколько buyback и другие механики реально передают рост продукта токену."],
    profile: { strengths:["Торговый продукт с измеримыми объемами и комиссиями","Понятная связь между активностью площадки и тезисом value capture"], weaknesses:["Доходы чувствительны к торговому циклу и волатильности","Value capture зависит от сохранения и исполнения buyback-механики"], risks:["Снижение торговых объемов и комиссий после охлаждения рынка","Оценка токена опережает рост продуктовой экономики","Конкуренция и регуляторные риски для perpetuals-площадки"], watch:["DEX-оборот вместе с комиссиями","Annualized Fees / Market Cap и DEX Volume / Market Cap","Покупки Assistance Fund и изменения token mechanics","Ликвидность и устойчивость активности трейдеров"] },
    verdict: (name) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: продуктовая экономика и value capture должны догонять оценку", paragraphs:[`${name} выглядит убедительно как growth / revenue asset, пока реальная торговая активность создает комиссии, а механика value capture передает часть успеха площадки токену. Главный риск — оценка, ушедшая вперед устойчивых объемов и комиссий.`] }),
    conclusions: { tokenomics:"Токеномика сильна только тогда, когда продуктовый оборот превращается в устойчивый спрос на HYPE и компенсирует supply-риски.", financials:"Комиссии и DEX-оборот — центральная проверка продуктового спроса; их нужно сопоставлять с капитализацией, а не смотреть изолированно.", capital:"Капитал экосистемы полезен как подтверждение глубины продукта, но не заменяет комиссии и торговый оборот.", liquidity:"Устойчивый оборот должен подтверждаться ликвидностью и повторяемой активностью, а не только интересом к самому токену.", narrative:"Для тезиса важны только новости, меняющие объемы, комиссии, продукт, ликвидность или value capture." },
  },
  [PROJECT_CATEGORIES.CONSUMER]: {
    hero: (name) => ({ title:name, subtitle:"Пользовательский проект", lead:`${name} оценивается через удержание аудитории и связь продукта с токеном.`, main_strength:"Повторяемое использование и потенциал сетевого эффекта.", main_risk:"Рост аудитории может не поддержать экономику токена.", status_text:"Фокус: удержание, повторное использование и монетизация." }),
    executive: () => ["Отделить удержание аудитории от разового охвата.", "Проверить повторяемость использования и монетизации.", "Понять, создает ли продукт спрос на токен."],
    profile: { strengths:["Пользовательская релевантность","Потенциал сетевого эффекта"], weaknesses:["Сложная монетизация аудитории","Спрос на токен может отставать от роста продукта"], risks:["Падение удержания пользователей","Слабая связь продукта с токеном"], watch:["Активных и возвращающихся пользователей","Связь использования со спросом на токен"] },
    verdict: (name, ticker) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: удержание должно переходить в экономику токена", paragraphs:[`${name} убедителен при устойчивом удержании и понятной связи продукта с токеном; главный риск — аудитория без монетизации и спроса на актив.`] }),
    conclusions: { tokenomics:"Токеномика работает, если поддерживает продукт, а не заменяет его.", financials:"Повторяемая монетизация важнее роста аудитории без дохода.", capital:"Капитал устойчив, когда следует за удержанием пользователей.", liquidity:"Ликвидность снижает риск позиции, но не компенсирует слабое удержание.", narrative:"Внимание ценно только при переходе в повторяемое использование." },
  },
});

const ORACLE_UTILITY_COPY = Object.freeze({
  hero: (name) => ({ title:name, subtitle:"Oracle / utility infrastructure asset", lead:`${name} оценивается через роль сети в доставке данных и межсетевом взаимодействии, масштаб интеграций и то, превращается ли использование сервисов в спрос на LINK.`, main_strength:"Критически важная инфраструктурная роль в данных, oracle-сервисах и межсетевых интеграциях.", main_risk:"Рост использования сети может не полностью и не сразу отражаться в спросе и цене токена.", status_text:"Фокус: utility LINK, adoption интеграций, ликвидность и качество захвата ценности." }),
  executive: () => ["Проверить, расширяется ли реальное использование oracle-сервисов, Data Feeds и CCIP.", "Отделить рост интеграций Chainlink от измеримого спроса на LINK и экономической выгоды держателя.", "Сопоставить рыночную оценку и ликвидность с качеством token utility и будущим value capture."],
  profile: { strengths:["Значимая роль в инфраструктуре данных и межсетевого взаимодействия","Широкая интеграционная поверхность и зрелая рыночная ликвидность"], weaknesses:["Связь между ростом использования сервисов и спросом на LINK не всегда прямая","Не все adoption-сигналы дают сопоставимые количественные метрики"], risks:["Использование сети растет быстрее, чем экономическая ценность LINK","Конкуренция oracle- и interoperability-решений","Оценка опережает подтверждаемый token demand"], watch:["Новые и расширяющиеся интеграции Data Feeds, CCIP и других сервисов","Механизмы оплаты, staking и передачи сетевой ценности LINK","Оборот, ликвидность и разрыв между Market Cap и FDV"] },
  verdict: (name) => ({ title:"Финальная оценка", subtitle:"Инвестиционный тезис: инфраструктурная полезность должна превращаться в спрос на LINK", paragraphs:[`${name} обладает сильной инфраструктурной значимостью и широким adoption-потенциалом, но инвестиционный тезис требует доказательства, что использование oracle-сервисов, данных и CCIP создает устойчивый спрос на LINK. Главный риск — рост полезности сети без пропорционального захвата ценности токеном.`] }),
  conclusions: { tokenomics:"Токеномика LINK важна не только структурой предложения: ключевой вопрос — создает ли оплата сервисов, staking и безопасность сети устойчивый спрос на токен сильнее потенциального разводнения.", liquidity:"Ликвидность и оборот делают LINK доступным для крупного рынка, но сами по себе не доказывают value capture.", valuation:"Оценку LINK следует сопоставлять с ликвидностью, adoption и качеством связи между использованием сервисов и спросом на токен, а не с TVL чужих сетей.", utility_adoption:"Интеграции и инфраструктурная значимость подтверждают полезность Chainlink; инвестиционная ценность зависит от того, насколько эта полезность превращается в спрос на LINK.", narrative:"Приоритет имеют новости об интеграциях, Data Feeds, CCIP, staking и механизмах, меняющих использование или value capture LINK." },
});

const PROJECT_COPY = Object.freeze({
  btc: {
    executive:["Оценить, сохраняет ли BTC глубокую ликвидность при росте волатильности.", "Сопоставить оценку с оборотом, доступным предложением и фазой рыночного цикла.", "Следить за институциональными потоками, ETF-спросом и макроусловиями."],
    profile:{ strengths:["Эталонная ликвидность и узнаваемость крипторынка","Предсказуемое максимальное предложение в 21 млн BTC"], weaknesses:["Нет денежного потока для классической оценки","Высокая зависимость цены от глобального аппетита к риску и ликвидности"], risks:["Циклическая переоценка и глубокие просадки","Снижение институциональных потоков","Регуляторные ограничения на рыночный доступ"], watch:["ETF-потоки, BTC dominance и устойчивость институционального спроса","Биржевые резервы, глубину рынка и оборот относительно капитализации","Цену относительно MVRV и realized price, а также темп эмиссии"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: глобальная денежная роль должна поддерживаться ликвидностью и спросом", paragraphs:["BTC остается базовым макро-активом крипторынка благодаря ограниченному предложению, глобальной ликвидности и институциональному доступу; главный риск — оценка, уходящая далеко вперед устойчивого спроса и рыночной фазы. Подтверждение тезиса — устойчивые потоки капитала, глубина рынка и отсутствие структурного ослабления спроса."]},
    conclusions:{ tokenomics:"Фиксированный предел 21 млн BTC, уже выпущенная доля предложения и предсказуемое замедление эмиссии формируют scarcity-тезис без произвольного разводнения.", demand_flows:"Спрос подтверждается не единичным ростом цены, а устойчивыми потоками капитала, BTC dominance и способностью глубокой ликвидности принимать крупные позиции.", liquidity:"Оборот и глубина рынка — основная проверка способности BTC обслуживать крупный капитал.", narrative:"Приоритет имеют события, меняющие ETF-потоки, институциональный спрос, доступ к рынку и макроусловия."},
  },
  eth: {
    executive:["Проверить, удерживает ли Ethereum расчетный капитал между L1, L2 и приложениями.", "Сопоставить комиссионный спрос и активность с оценкой ETH.", "Следить за выпуском и сжиганием как итогом спроса на блокспейс."],
    profile:{ strengths:["Крупнейший расчетный капитал экосистемы","Глубокий рынок базового актива"], weaknesses:["Ценность распределяется между L1, L2 и приложениями","Зрелая оценка требует сильной экономики"], risks:["Ослабление спроса на блокспейс","Уход захвата ценности в другие слои"], watch:["Комиссии и чистую эмиссию","Капитал и активность между L1 и L2"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: расчетный капитал должен создавать спрос на ETH", paragraphs:["ETH сохраняет сильную инфраструктурную позицию, пока расчетный капитал и безопасность поддерживают спрос на актив; главный риск — уход создаваемой ценности в L2 и приложения."]},
    conclusions:{ tokenomics:"Баланс выпуска и сжигания показывает итоговый спрос на блокспейс Ethereum.", financials:"Комиссии проверяют платный спрос на расчетный слой Ethereum.", capital:"Динамика TVL и стейблкоинов показывает устойчивость расчетного капитала.", liquidity:"Глубокий рынок упрощает управление позицией, но не решает вопрос захвата ценности.", narrative:"Обновления сети значимы, если усиливают использование и спрос на ETH."},
  },
  mnt: {
    executive:["Проверить, удерживает ли Mantle капитал, стейблкоин-ликвидность и on-chain активность.", "Сопоставить оценку MNT с TVL, комиссиями, DEX-оборотом и ролью токена.", "Оценить риск того, что экосистема растет быстрее, чем спрос и value capture MNT."],
    profile:{ strengths:["Капитал и ликвидность внутри Mantle ecosystem","Гибридная инфраструктурная и экосистемная роль MNT"], weaknesses:["Рост экосистемы не гарантирует полного захвата ценности MNT","Сетевой спрос должен догонять масштаб капитала"], risks:["Отток TVL или стейблкоин-ликвидности","Слабая передача роста экосистемы токену","Оценка опережает комиссии и usage"], watch:["TVL, стейблкоины и DEX-оборот Mantle","Комиссии и активность сети","Роль MNT и Market Cap / TVL"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: капитал Mantle должен создавать устойчивый спрос на MNT", paragraphs:["MNT выглядит как hybrid infrastructure / ecosystem asset: тезис усиливают растущий капитал, ликвидность и использование Mantle. Главный риск — экосистема создает ценность, которую MNT захватывает лишь частично."]},
  },
  near: {
    executive:["Отделить реальное usage и экосистемный рост NEAR от силы AI / chain-abstraction нарратива.", "Сопоставить оценку с TVL, ликвидностью, комиссиями и adoption-сигналами.", "Проверить, превращаются ли продукты, разработка и активность экосистемы в спрос на NEAR."],
    profile:{ strengths:["Инфраструктурный стек и направления ecosystem adoption","Ликвидный рыночный профиль и сильная narrative relevance"], weaknesses:["Нарратив может расти быстрее капитала и платного usage","Связь adoption со спросом на NEAR требует постоянной проверки"], risks:["AI / chain-abstraction нарратив опережает реальную экономику","Слабые комиссии или капитал при высокой оценке","Конкуренция за разработчиков и пользователей"], watch:["Usage, комиссии и экосистемную активность","TVL, стейблкоины и ликвидность","Подтверждение narrative измеримым adoption"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: adoption должен подтверждать инфраструктурный и AI-нарратив", paragraphs:["NEAR интересен как infrastructure + ecosystem growth case, но сильный нарратив сам по себе не является фундаментальным подтверждением. Тезис требует, чтобы usage, капитал, ликвидность и комиссии догоняли ожидания рынка и создавали спрос на NEAR."]},
  },
  sol: {
    executive:["Проверить, удерживается ли быстро привлеченный капитал в Solana.", "Отделить устойчивые комиссии и оборот от краткосрочного всплеска активности.", "Оценить, какая часть экономики приложений создает спрос на SOL."],
    profile:{ strengths:["Быстрый рост капитала и внутрисетевого оборота","Высокая пропускная способность для приложений"], weaknesses:["Качество активности неоднородно","Ценность распределяется между приложениями и базовым слоем"], risks:["Охлаждение торговой активности","Отток быстро привлеченного капитала"], watch:["Удержание TVL и стейблкоинов","Комиссии и глубину внутрисетевого оборота"]},
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: быстрый рост должен стать устойчивым спросом на SOL", paragraphs:["SOL выглядит убедительно, пока экосистема удерживает капитал и создает повторяемые комиссии; главный риск — быстрое охлаждение активности после смены цикла."]},
    conclusions:{ tokenomics:"Спрос на SOL должен перекрывать давление предложения по мере роста сети.", financials:"Качество комиссий важнее рекордного числа дешевых операций.", capital:"Удержание TVL и стейблкоинов покажет, переживает ли рост Solana смену цикла.", liquidity:"Сильный оборот полезен, пока рынок сохраняет глубину при выходе капитала.", narrative:"Темп роста значим, если превращается в устойчивую экономику базового слоя."},
  },
  hype: {
    executive:["Hyperliquid нужно оценивать как торговый продукт с измеримыми оборотом и комиссиями, а HYPE — как growth / revenue asset с механизмом value capture.", "Рыночная цена должна подтверждаться устойчивостью DEX-оборота, комиссий, TVL и спроса трейдеров, а не только нарративом.", "Supply-риск и качество Assistance Fund важны не меньше текущего роста продукта."],
    profile:{ strengths:["Сильный продуктовый спрос и торговая активность", "Понятный канал value capture через Assistance Fund"], weaknesses:["Доходы чувствительны к торговому циклу", "Будущее предложение повышает требования к росту"], risks:["Снижение оборота и комиссий", "Ослабление или изменение value capture", "Рост FDV быстрее продуктовой экономики"], watch:["Комиссии и DEX-оборот одновременно", "TVL и расчетную ликвидность", "Покупки Assistance Fund и динамику предложения"] },
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: продуктовая экономика должна оправдывать growth-оценку", paragraphs:["HYPE выглядит сильным revenue-driven growth asset, пока Hyperliquid удерживает торговый оборот, комиссии и ликвидность, а Assistance Fund сохраняет понятный value capture. Главный риск — рост оценки и будущего предложения быстрее устойчивой продуктовой экономики."] },
    conclusions:{ tokenomics:"Числовая структура предложения показывает supply-риск, а Assistance Fund объясняет канал value capture; buyback не отменяет возможное давление emissions и распределений.", financials:"Комиссии и DEX-оборот должны расти совместно: именно это подтверждает платящий продуктовый спрос и качество revenue-тезиса.", capital:"TVL, расчетная ликвидность и Market Cap / TVL показывают, достаточно ли капитала поддерживает торговый продукт относительно оценки HYPE.", narrative:"В ленте остаются только события Hyperliquid, меняющие оборот, комиссии, ликвидность, продукт или value capture." },
  },
  pendle: {
    executive:["Pendle оценивается через полезность рынка доходности и востребованность механики PT / YT.", "TVL, торговая активность и комиссии должны подтверждать, что продукт используется за пределами краткосрочных incentive-циклов.", "Инвестиционный тезис зависит от того, превращается ли usage в устойчивый спрос и value capture PENDLE при разумной оценке."],
    profile:{ strengths:["Уникальная продуктовая механика PT / YT", "TVL и usage дают измеримые сигналы product-market fit"], weaknesses:["Спрос чувствителен к доходностям и DeFi-циклу", "Связь usage с ценностью токена требует постоянной проверки"], risks:["Снижение спроса на yield trading", "Оценка опережает комиссии и usage", "Конкуренция и фрагментация ликвидности"], watch:["TVL и торговую активность PT / YT", "Комиссии и revenue", "Value capture и valuation относительно usage"] },
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: PT / YT utility должна превращаться в устойчивый token capture", paragraphs:["PENDLE — продуктовый DeFi-актив с понятной специализацией на торговле доходностью. Сильный тезис требует устойчивых TVL, usage и комиссий, а также доказательства, что оценка и спрос на токен не опережают реальное использование PT / YT."] },
    conclusions:{ tokenomics:"Предложение PENDLE нужно сопоставлять с utility и token capture: продуктовый рост ценен для держателя только при достаточном спросе на токен.", financials:"Комиссии и торговая активность показывают, насколько PT / YT используются как реальный продукт, а не только как временный incentive trade.", capital:"TVL подтверждает капитал в продукте; Market Cap / TVL помогает увидеть, насколько чувствительна оценка PENDLE к замедлению usage.", narrative:"Приоритет имеют события, меняющие PT / YT usage, TVL, комиссии, интеграции или token capture." },
  },
  crv: {
    executive:["Curve следует оценивать через его роль в DeFi-ликвидности, DEX-активность и устойчивость TVL.", "veCRV делает governance и распределение emissions центральной частью инвестиционного тезиса.", "Сильная роль протокола не гарантирует сильный CRV: value capture должен перекрывать давление предложения и конкуренцию."],
    profile:{ strengths:["Системная роль в DeFi-ликвидности", "veCRV связывает governance с направлением incentives"], weaknesses:["Постоянное давление emissions", "Ценность протокола не всегда прямо переходит держателю CRV"], risks:["Ослабление TVL и DEX-активности", "Emissions превосходят органический спрос", "Конкуренция за ликвидность и governance relevance"], watch:["Темп emissions и структуру предложения", "TVL, DEX-оборот и комиссии", "Спрос на veCRV и качество value capture"] },
    verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: роль в ликвидности должна перекрывать tokenomics pressure", paragraphs:["CRV сохраняет значимую роль через Curve liquidity и veCRV governance, но инвестиционный тезис остается чувствительным к emissions. Позитивный сценарий требует устойчивых TVL, DEX-активности и комиссий, которые создают спрос и value capture быстрее давления предложения."] },
    conclusions:{ tokenomics:"Для CRV tokenomics — центральный риск: veCRV усиливает governance utility, но emissions и supply pressure должны перекрываться органическим спросом.", financials:"DEX-оборот и комиссии показывают экономическую актуальность Curve; высокая активность протокола важна только при достаточном value capture токена.", capital:"TVL показывает роль Curve в DeFi-ликвидности, а Market Cap / TVL помогает сопоставить эту роль с оценкой CRV.", narrative:"Приоритет имеют новости о Curve liquidity, veCRV governance, emissions, комиссиях и конкуренции." },
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

function prioritiesFor(slot, profile, project) {
  const configured = project?.reportOptions?.[`${slot}Kpis`];
  if (Array.isArray(configured)) return configured;
  if (profile.analysisProfile === ANALYSIS_PROFILES.ORACLE_UTILITY) {
    const oracle = {
      hero:["price", "market_cap", "fdv", "volume_24h", "trading_quality", "token_utility", "adoption", "circulating_supply", "liquidity"],
      market:["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity"],
      tokenomics:["market_cap", "fdv", "circulating_supply", "total_supply", "max_supply"],
      financial:[], capital:[],
    };
    return oracle[slot] || [];
  }
  const priorities = METRIC_SLOT_PRIORITIES[slot] || {};
  return priorities[profile.category] || priorities.default || [];
}

export function selectMetricSlots(report, project, slot, limit = Infinity) {
  const profile = getProjectProfile(project);
  return prioritiesFor(slot, profile, project).flatMap((key) => {
    const definition = KPI_DEFINITIONS[key];
    const metric = definition ? getPath(report, definition.path) : null;
    return definition && supports(definition, profile.capabilities) && isAvailableMetric(metric, definition)
      ? [{ key, label:definition.label, metric }]
      : [];
  }).slice(0, limit);
}

export function selectHeroKpis(report, project, limit = project?.reportOptions?.heroKpiLimit || 6) {
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

  const hybrid = profile.category === PROJECT_CATEGORIES.HYBRID_ECOSYSTEM || profile.category === PROJECT_CATEGORIES.ECOSYSTEM_GROWTH;
  const tradingVenue = profile.category === PROJECT_CATEGORIES.TRADING_VENUE;
  return {
    market: allocate("market", 8),
    tokenomics: allocate("tokenomics", 8),
    financial: allocate("financial", tradingVenue ? 5 : (hybrid ? 4 : 3)),
    capital: allocate("capital", 5).slice(0, hybrid || tradingVenue ? 4 : 3),
  };
}

export function applyProfileAwareSemantics(report, project, { preserveCurated = false } = {}) {
  if (!report || !project) return report;
  const profile = getProjectProfile(project);
  const copy = profile.analysisProfile === ANALYSIS_PROFILES.ORACLE_UTILITY ? ORACLE_UTILITY_COPY : (PROFILE_COPY[profile.category] || PROFILE_COPY[PROJECT_CATEGORIES.UTILITY]);
  const projectCopy = PROJECT_COPY[project.slug] || {};
  const name = project.name || report.meta?.project_name || project.ticker;
  const ticker = project.ticker || report.meta?.ticker || "TOKEN";
  const useGeneratedCopy = !preserveCurated;

  if (profile.analysisProfile === ANALYSIS_PROFILES.CEX_CHAIN_HYBRID && project.slug === "bnb") {
    report.semantic_metrics = {
      ...(report.semantic_metrics || {}),
      exchange_utility:{ value:null, formatted:"Binance ecosystem utility", status:"static", source:"project structure" },
      token_utility:{ value:null, formatted:"CEX utility + gas + ecosystem asset", status:"static", source:"project structure" },
      adoption:{ value:null, formatted:"Binance ecosystem + BNB Chain", status:"static", source:"project structure" },
    };
    report.tokenomics = report.tokenomics || { metrics:{} };
    report.tokenomics.metrics = {
      ...(report.tokenomics.metrics || {}),
      burn_mechanism:{ value:null, formatted:"Auto-Burn + BEP-95", status:"static", source:"BNB Chain documentation" },
      burn_target:{ value:100_000_000, formatted:"100 млн BNB", status:"static", source:"BNB Chain documentation" },
    };
    report.tokenomics.text = [
      "Circulating supply показывает доступное рынку предложение BNB, а current supply — сколько BNB остается после уже проведенных сжиганий; обе live-метрики нужно отслеживать вместе с целью в 100 млн BNB.",
      "Auto-Burn периодически сокращает предложение по формуле, связанной с ценой BNB и активностью BNB Smart Chain, а BEP-95 дополнительно сжигает часть gas fees в реальном времени.",
      "Burn усиливает scarcity-тезис, но не заменяет реальный спрос: оценка BNB должна подтверждаться utility внутри Binance, использованием BNB как gas/base asset и капиталом BNB Chain.",
    ];
    report.valuation = report.valuation || { metrics:{} };
    report.valuation.text = [
      "BNB нельзя оценивать только как L1 или только как биржевой токен: цену нужно сопоставлять с оборотом, комиссиями и капиталом BNB Chain, одновременно проверяя устойчивость utility внутри Binance.",
      "Volume / Market Cap отражает торговую востребованность, Annualized Chain Fees / Market Cap — масштаб платного on-chain спроса относительно оценки, а TVL и Stablecoins / TVL — глубину капитала и расчетной ликвидности BNB Chain.",
    ];
  }

  if (profile.analysisProfile === ANALYSIS_PROFILES.INFRA_ECOSYSTEM_GROWTH) {
    const isMantle = project.slug === "mnt";
    report.semantic_metrics = {
      ...(report.semantic_metrics || {}),
      token_utility:{ value:null, formatted:isMantle ? "Gas + Mantle ecosystem asset" : "Gas + staking + ecosystem coordination", status:"static", source:"project structure" },
      ...(isMantle ? {} : { adoption:{ value:null, formatted:"Usage + developer ecosystem + chain abstraction", status:"manual", source:"project profile" } }),
    };
    report.tokenomics = report.tokenomics || { metrics:{} };
    report.tokenomics.text = isMantle
      ? ["MNT нужно оценивать как hybrid ecosystem asset: роль газа и участие в структуре Mantle важны только вместе с измеримым ростом капитала, ликвидности и usage.", "Market Cap, FDV и supply-профиль показывают цену ожиданий; главный вопрос — насколько полно MNT захватывает ценность растущей экосистемы."]
      : ["NEAR выполняет инфраструктурную роль через gas, staking и координацию экосистемы; supply и FDV нужно сопоставлять с реальным usage и спросом на токен.", "AI и chain-abstraction narrative усиливают опциональность, но без капитала, комиссий и adoption не доказывают token value capture."];
    report.valuation = report.valuation || { text:[], metrics:{} };
    report.valuation.text = isMantle
      ? ["Оценку MNT следует сопоставлять с TVL, стейблкоин-ликвидностью, DEX-оборотом и комиссиями, отдельно дисконтируя риск неполного value capture."]
      : ["Оценку NEAR следует сопоставлять с usage, капиталом, ликвидностью и комиссиями; narrative premium оправдан только при измеримом adoption."];
    if (!isMantle) report.utility_adoption = { items:["Инфраструктурный и developer adoption важен только при переходе в измеримое использование сети.", "AI-related и chain-abstraction обновления учитываются, когда они относятся к продуктам NEAR и подтверждаются activity, capital или demand signals.", "Если narrative растет быстрее usage и комиссий, отчет трактует это как риск, а не как фундаментальное преимущество."] };
  }

  if (profile.analysisProfile === ANALYSIS_PROFILES.TRADING_ECONOMICS && project.slug === "hype") {
    report.semantic_metrics = {
      ...(report.semantic_metrics || {}),
      value_capture:{ value:null, formatted:"Assistance Fund market buybacks", status:"static", source:"Hyperliquid mechanism" },
      token_utility:{ value:null, formatted:"Trading ecosystem + staking + value capture", status:"static", source:"project structure" },
      adoption:{ value:null, formatted:"Trading volume, liquidity and trader activity", status:"static", source:"project structure" },
    };
    report.tokenomics = report.tokenomics || { metrics:{} };
    report.tokenomics.metrics = {
      ...(report.tokenomics.metrics || {}),
      market_buyback:{ value:null, formatted:"Assistance Fund buys HYPE", status:"static", source:"Hyperliquid mechanism" },
    };
    report.tokenomics.text = [
      "HYPE связан с продуктом через экономику Hyperliquid: торговая активность создает комиссии, а Assistance Fund использует часть экономики площадки для покупок HYPE на рынке.",
      "Value capture нужно проверять по фактическим комиссиям, устойчивости buyback-механики и тому, создает ли рост площадки повторяемый спрос на токен.",
      "Circulating supply, total supply и FDV показывают supply-риск; сильный продуктовый рост не отменяет давление будущего предложения, emissions или распределений.",
    ];
    report.valuation = report.valuation || { text:[], metrics:{} };
    report.valuation.text = [
      "HYPE следует оценивать как growth / revenue asset: капитализация и FDV должны сопоставляться с комиссиями, DEX-оборотом и устойчивостью value capture.",
      "Annualized Fees / Market Cap и DEX Volume / Market Cap помогают проверить, не ушла ли оценка вперед продуктовой экономики; они не заменяют анализ качества и цикличности доходов.",
    ];
    report.liquidity = report.liquidity || { text:[], metrics:{} };
    report.liquidity.text = [
      "Торговая активность должна подтверждать продуктовый спрос: важны не только обороты HYPE на рынке, но и DEX-оборот самой площадки.",
      "Устойчивый тезис требует совместного движения объемов и комиссий; рост токена без подтверждения продуктовой активностью повышает риск переоценки.",
    ];
  }

  if (profile.analysisProfile === ANALYSIS_PROFILES.PRODUCT_DEFI_ECONOMICS) {
    const isPendle = project.slug === "pendle";
    report.semantic_metrics = {
      ...(report.semantic_metrics || {}),
      token_utility:{ value:null, formatted:isPendle ? "PT / YT markets + vePENDLE incentives" : "veCRV locking + gauges + governance", status:"static", source:"project structure" },
      protocol_usage:{ value:null, formatted:isPendle ? "PT / YT trading and yield markets" : "Liquidity pools, swaps and gauges", status:"static", source:"project structure" },
      value_capture:{ value:null, formatted:isPendle ? "vePENDLE incentives and protocol economics" : "veCRV fees, gauges and governance", status:"static", source:"project structure" },
      ...(isPendle ? {} : {
        emission_pressure:{ value:null, formatted:"Ongoing CRV emissions", status:"static", source:"token structure" },
        governance_role:{ value:null, formatted:"veCRV gauges and governance", status:"static", source:"project structure" },
      }),
    };
    report.tokenomics = report.tokenomics || { metrics:{} };
    report.tokenomics.text = isPendle ? [
      "PENDLE получает utility через рынки PT / YT и vePENDLE incentives; ключевой вопрос — превращается ли product usage в устойчивый спрос и value capture токена.",
      "Circulating supply, total supply, max supply и FDV задают числовой каркас supply-рискa; их нужно сопоставлять с TVL, торговой активностью и комиссиями.",
    ] : [
      "CRV нельзя анализировать без veCRV: блокировка токена дает governance-влияние и контроль над gauges, связывая спрос с распределением ликвидности и incentives.",
      "Одновременно emissions создают постоянное давление предложения, поэтому circulating, total и max supply нужно оценивать вместе с органическим спросом и value capture.",
    ];
    report.valuation = report.valuation || { text:[], metrics:{} };
    report.valuation.text = isPendle ? ["Оценка PENDLE должна подтверждаться TVL, PT / YT usage, торговой активностью, комиссиями и качеством token capture."] : ["Оценка CRV должна учитывать роль Curve в ликвидности, но дисконтировать emissions pressure, конкуренцию и неполную передачу ценности токену."];
  }

  if (profile.analysisProfile === ANALYSIS_PROFILES.ORACLE_UTILITY) {
    report.semantic_metrics = {
      ...(report.semantic_metrics || {}),
      token_utility:{ value:null, formatted:"Оплата сервисов + staking / security", status:"manual", source:"project profile" },
      adoption:{ value:null, formatted:"Интеграции Data Feeds, CCIP и сервисов", status:"manual", source:"project profile" },
    };
    report.tokenomics = report.tokenomics || { metrics:{} };
    report.tokenomics.text = [
      "LINK нужен в экономике Chainlink для оплаты сервисов и участия в staking / security-механизмах; поэтому спрос на токен должен оцениваться вместе с реальным использованием сети.",
      "Supply-структура, доля обращения и разрыв между Market Cap и FDV показывают потенциальное давление предложения, но не отвечают на вопрос value capture без данных о token demand.",
      "Главный вопрос инвестора: растет ли ценность LINK вместе с полезностью Chainlink и насколько прямо сервисные платежи, staking и безопасность передают эту ценность токену.",
    ];
    report.risks = { items:[...ORACLE_UTILITY_COPY.profile.risks] };
    report.watchlist = { items:[...ORACLE_UTILITY_COPY.profile.watch] };
    report.utility_adoption = {
      items:[
        "Chainlink связывает смарт-контракты с внешними данными и межсетевыми сообщениями; Data Feeds и CCIP — ключевые направления проверки adoption.",
        "LINK используется в экономике сервисов и staking / security-механизмах, но степень прямой передачи роста использования держателю токена остается главным вопросом.",
        "Количество интеграций само по себе не равно выручке или token demand; без надежной сопоставимой live-метрики отчет не подменяет этот пробел выдуманным KPI.",
      ],
    };
  }

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
