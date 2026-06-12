import { PROJECT_CATEGORIES, getProjectProfile } from "../config/projects.js";

const KPI_DEFINITIONS = Object.freeze({
  price: { label: "Цена", path: "market.price" },
  market_cap: { label: "Рыночная капитализация", path: "market.market_cap" },
  fdv: { label: "FDV", path: "market.fdv", capability: "hasTokenomics" },
  volume_24h: { label: "Объем 24ч", path: "market.volume_24h" },
  circulating_supply: { label: "Circulating Supply", path: "tokenomics.metrics.circulating_supply", capability: "hasTokenomics", requireValue: true },
  total_supply: { label: "Total Supply", path: "tokenomics.metrics.total_supply", capability: "hasTokenomics", requireValue: true },
  max_supply: { label: "Max Supply", path: "tokenomics.metrics.max_supply", capability: "hasTokenomics", requireValue: true },
  net_issuance: { label: "Net Issuance", path: "tokenomics.metrics.net_issuance", capability: "hasTokenomics" },
  burn_mechanism: { label: "Burn Mechanism", path: "tokenomics.metrics.burn_mechanism", capability: "hasTokenomics" },
  market_buyback: { label: "Market Buyback", path: "tokenomics.metrics.market_buyback", capability: "hasTokenomics" },
  tvl: { label: "TVL", path: "capital.metrics.tvl", capability: "hasTvl" },
  stablecoins: { label: "Stablecoins Mcap", path: "capital.metrics.stablecoins_mcap", capability: "hasStablecoins" },
  rwa: { label: "RWA Active Mcap", path: "capital.metrics.rwa_active_mcap", capability: "hasRwa" },
  market_cap_tvl: { label: "Market Cap / TVL", path: "valuation.metrics.market_cap_tvl", capability: "hasTvl" },
  stablecoins_tvl: { label: "Stablecoins / TVL", path: "valuation.metrics.stablecoins_tvl", capability: "hasStablecoins" },
  app_fees: { label: "Protocol / App Fees 24h", path: "financials.metrics.app_fees_24h", capability: "hasProtocolFees" },
  fees: { label: "Chain Fees 24h", path: "financials.metrics.chain_fees_24h", capability: "hasChainFees" },
  dex_volume: { label: "DEX Volume 24h", path: "financials.metrics.dex_volume_24h", capability: "hasDexVolume" },
  trading_quality: { label: "Объем 24ч / капитализация", path: "financials.metrics.volume_market_cap" },
  liquidity: { label: "Ликвидность", path: "semantic_metrics.liquidity", capability: "hasLiquidityData" },
  concentration: { label: "Концентрация / whale risk", path: "semantic_metrics.concentration", capability: "hasWhaleData" },
  momentum: { label: "Нарратив / momentum", path: "semantic_metrics.narrative_momentum", capability: "hasNarrativeMomentum" },
  token_utility: { label: "Роль токена", path: "semantic_metrics.token_utility", capability: "hasTokenUtilityData" },
  adoption: { label: "Adoption / integrations", path: "semantic_metrics.adoption", capability: "hasAdoptionData" },
  users: { label: "Активные пользователи", path: "users.metrics.daily_active_addresses", capability: "hasUsersData" },
});

export const METRIC_SLOT_PRIORITIES = Object.freeze({
  hero: {
    [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "tvl", "stablecoins", "fees", "app_fees", "dex_volume", "users"],
    [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "fdv", "tvl", "app_fees", "fees", "dex_volume", "users", "trading_quality", "liquidity"],
    [PROJECT_CATEGORIES.MEME]: ["price", "market_cap", "volume_24h", "trading_quality", "circulating_supply", "total_supply", "max_supply", "liquidity", "concentration", "momentum"],
    [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply", "token_utility", "liquidity", "adoption", "concentration"],
    [PROJECT_CATEGORIES.CONSUMER]: ["price", "market_cap", "volume_24h", "users", "adoption", "momentum", "liquidity"],
  },
  market: {
    [PROJECT_CATEGORIES.INFRA]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality"],
    [PROJECT_CATEGORIES.DEFI]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "liquidity"],
    [PROJECT_CATEGORIES.MEME]: ["price", "market_cap", "volume_24h", "trading_quality", "circulating_supply", "total_supply", "max_supply", "liquidity", "concentration", "momentum"],
    [PROJECT_CATEGORIES.UTILITY]: ["price", "market_cap", "fdv", "volume_24h", "trading_quality", "circulating_supply", "total_supply", "max_supply", "liquidity", "token_utility", "adoption"],
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
    hero: (name) => ({ title:name, subtitle:"Инфраструктурный актив", lead:`${name} оценивается через роль сети, капитал и качество экономической активности.`, main_strength:"Сетевая роль и способность удерживать капитал экосистемы.", main_risk:"Оценка может расти быстрее экономики сети или ценность уйдет в другие слои.", status_text:"Тезис подтверждают устойчивые пользователи, комиссии и капитал." }),
    executive: (name) => [`${name} — ставка на роль сети и глубину экосистемы.`, "Капитал и ликвидность определяют устойчивость инфраструктурной позиции.", "Комиссии и пользователи должны подтверждать живую экономику сети.", "Инвесторский вопрос: оправдывает ли эта экономика текущую оценку?"],
    profile: { strengths:["Сеть удерживает капитал экосистемы","Ликвидный базовый актив","Экономика подтверждается on-chain спросом"], weaknesses:["Ценность распределяется между слоями","Высокая оценка требует постоянного подтверждения","Конкуренция за капитал и разработчиков"], risks:["Отток капитала и пользователей","Снижение комиссионного спроса","Оценка опережает сетевую экономику"], watch:["Потоки TVL и стейблкоинов","Пользователей и комиссии","Где остается создаваемая ценность"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Infra: качество сети против текущей оценки", paragraphs:[`${name} остается убедительным, пока сеть удерживает капитал, пользователей и комиссионный спрос.`, "Инвестиционный итог зависит от того, оправдывает ли глубина экосистемы текущую оценку актива."] }),
    conclusions: { tokenomics:"Предложение важно оценивать через давление выпуска и спрос на базовый актив сети.", financials:"Комиссии ценны только как устойчивое подтверждение спроса на сеть.", capital:"Удержание TVL и расчетной ликвидности показывает качество экосистемного капитала.", liquidity:"Глубокий рынок снижает риск выхода, но не заменяет сетевой фундаментал.", narrative:"Нарратив усиливает тезис только тогда, когда за ним растут капитал и использование." },
  },
  [PROJECT_CATEGORIES.DEFI]: {
    hero: (name) => ({ title:name, subtitle:"DeFi-протокол", lead:`${name} оценивается как финансовый продукт: через использование, доход и роль токена.`, main_strength:"Повторяемый продуктовый спрос и комиссионная экономика.", main_risk:"Продукт может расти без захвата ценности токеном.", status_text:"Тезис подтверждают качественный TVL, revenue и token capture." }),
    executive: (name) => [`${name} — финансовый продукт, а не просто TVL.`, "Fees и revenue показывают качество использования.", "Токен ценен, только если захватывает часть продуктовой экономики.", "Главный риск — отток ликвидности или спроса после снижения стимулов."],
    profile: { strengths:["Повторяемое использование продукта","Комиссионная экономика","Ликвидность внутри DeFi"], weaknesses:["TVL может зависеть от стимулов","Revenue не всегда достается токену","Продуктовые механики легко копируются"], risks:["Отток TVL и ликвидности","Снижение fees и revenue","Слабый захват ценности токеном"], watch:["Качество и устойчивость TVL","Fees, revenue и повторное использование","Механизм token value capture"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"DeFi: продуктовая экономика и ценность токена", paragraphs:[`${name} интересен, если продукт сохраняет TVL, генерирует доход и удерживает спрос без избыточных стимулов.`, "Решающий вопрос — превращается ли эта экономика в измеримую ценность для токена."] }),
    conclusions: { tokenomics:"Структура предложения вторична без понятного механизма захвата продуктовой ценности.", financials:"Устойчивые fees и revenue важнее краткого всплеска активности.", capital:"Качественный TVL удерживается продуктом, а не только вознаграждениями.", liquidity:"Ликвидность определяет устойчивость продукта при выходе капитала.", narrative:"Продуктовые метрики должны подтверждать нарратив быстрее, чем растет оценка." },
  },
  [PROJECT_CATEGORIES.MEME]: {
    hero: (name) => ({ title:name, subtitle:"Meme / attention asset", lead:`${name} оценивается через качество рынка, ликвидность и устойчивость внимания.`, main_strength:"Узнаваемый нарратив и способность концентрировать оборот.", main_risk:"Внимание и ликвидность могут схлопнуться одновременно.", status_text:"Meme-тезис силен, пока рынок удерживает оборот и внимание." }),
    executive: (name) => [`${name} — ставка на внимание рынка, а не на денежный поток.`, "Ликвидность и оборот определяют качество входа и выхода.", "Концентрация усиливает риск резкого движения против держателей.", "Главный риск — быстрый unwind при потере импульса."],
    profile: { strengths:["Высокая узнаваемость нарратива","Способность концентрировать оборот","Простая рыночная история"], weaknesses:["Нет фундаментального денежного потока","Спрос зависит от внимания","Цена чувствительна к крупным держателям"], risks:["Резкий unwind ликвидности","Потеря нарративного импульса","Продажи крупных держателей"], watch:["Оборот относительно капитализации","Глубину ликвидности","Концентрацию и устойчивость внимания"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Meme: ликвидность, внимание и риск unwind", paragraphs:[`${name} остается рыночным тезисом, пока нарратив поддерживает высокий оборот и доступный выход из позиции.`, "Инвесторский итог определяется концентрацией и риском резкого unwind внимания."] }),
    conclusions: { tokenomics:"Для meme-актива важнее концентрация предложения, чем сложность токеномики.", financials:"Оборот показывает силу рынка, но не создает фундаментальный доход.", capital:"Капитал здесь подвижен: его устойчивость зависит от внимания и ликвидности.", liquidity:"Ликвидность — ключевая защита от болезненного unwind.", narrative:"Устойчивость внимания важнее единичного новостного всплеска." },
  },
  [PROJECT_CATEGORIES.UTILITY]: {
    hero: (name) => ({ title:name, subtitle:"Utility-токен", lead:`${name} оценивается через роль токена в продукте и реальный спрос на него.`, main_strength:"Практическая роль токена в работающем продукте.", main_risk:"Продукт может развиваться без спроса на токен.", status_text:"Utility-тезис силен при прямой связи adoption и token demand." }),
    executive: (name) => [`${name} должен быть необходим продукту, а не просто связан с брендом.`, "Рыночная значимость зависит от реального использования токена.", "Ликвидность определяет качество доступа к utility-тезису.", "Главный вопрос — создает ли продуктовый спрос спрос на токен?"],
    profile: { strengths:["Понятная практическая роль токена","Потенциал спроса через продукт","Интеграции расширяют использование"], weaknesses:["Utility может быть необязательной","Adoption продукта не гарантирует token demand","Ликвидность может быть ограниченной"], risks:["Продукт растет без спроса на токен","Utility теряет востребованность","Оценка опережает использование"], watch:["Необходимость токена в продукте","Adoption и интеграции","Связь product demand с token demand"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Utility: необходимость токена против оценки", paragraphs:[`${name} убедителен, только если использование продукта создает измеримый и устойчивый спрос на токен.`, "Финальный фильтр — оправдывает ли эта связь текущую оценку и ликвидность."] }),
    conclusions: { tokenomics:"Предложение имеет смысл оценивать вместе с реальной потребностью в токене.", financials:"Экономика продукта важна лишь в той мере, в какой поддерживает token demand.", capital:"Капитал подтверждает utility только при связи с использованием продукта.", liquidity:"Достаточная ликвидность снижает риск выхода из utility-позиции.", narrative:"Интеграции ценны, когда превращаются в измеримое использование токена." },
  },
  [PROJECT_CATEGORIES.CONSUMER]: {
    hero: (name) => ({ title:name, subtitle:"Consumer-проект", lead:`${name} оценивается через пользователей, удержание и связь продукта с токеном.`, main_strength:"Пользовательский продукт и потенциал сетевого эффекта.", main_risk:"Рост аудитории может не поддержать экономику токена.", status_text:"Тезис подтверждают retention и повторяемое использование." }),
    executive: (name) => [`${name} должен удерживать пользователей, а не только привлекать их.`, "Продуктовая активность важнее разового охвата.", "Токен ценен при прямой связи с использованием продукта.", "Главный риск — потеря retention и внимания."],
    profile: { strengths:["Пользовательская релевантность","Потенциал сетевого эффекта","Повторяемая продуктовая активность"], weaknesses:["Сложная монетизация аудитории","Token demand может отставать от adoption","Высокая конкуренция за внимание"], risks:["Падение активности и retention","Слабая связь продукта с токеном","Недостаточная ликвидность"], watch:["Активных пользователей и retention","Повторяемую продуктовую активность","Связь использования со спросом на токен"] },
    verdict: (name, ticker) => ({ title:`Финальная оценка ${ticker}`, subtitle:"Consumer: retention и экономика токена", paragraphs:[`${name} убедителен при устойчивом использовании и удержании аудитории.`, "Инвестиционный итог зависит от того, превращается ли adoption в спрос на токен."] }),
    conclusions: { tokenomics:"Токеномика работает, если поддерживает продукт, а не заменяет его.", financials:"Повторяемая монетизация важнее роста аудитории без дохода.", capital:"Капитал устойчив, когда следует за удержанием пользователей.", liquidity:"Ликвидность снижает риск позиции, но не компенсирует слабый retention.", narrative:"Внимание ценно только при переходе в повторяемое использование." },
  },
});

const PROJECT_COPY = Object.freeze({
  eth: {
    executive:["Ethereum остается зрелым базовым активом крупнейшей smart-contract экосистемы.", "Глубина капитала и ликвидности поддерживает инфраструктурный статус ETH.", "Комиссии и пользователи должны подтверждать спрос на расчетный слой.", "Главный вопрос — сколько ценности удерживает ETH между L1, L2 и приложениями."],
    profile:{ strengths:["Базовый актив зрелой экосистемы","Глубокий рынок и крупный капитал","Спрос поддерживают расчеты и безопасность"], weaknesses:["Ценность распределяется между L1 и L2","Зрелая оценка требует сильной экономики","Спрос на блокспейс остается цикличным"], risks:["Ослабление комиссионного спроса","Размывание ценности по слоям","Оценка опережает рост сети"], watch:["Комиссии и чистую эмиссию","Капитал и активность пользователей","Захват ценности между L1 и L2"]},
    verdict:{ title:"Финальная оценка ETH", subtitle:"Инфраструктура: удержание ценности важнее масштаба", paragraphs:["ETH сохраняет сильный статус благодаря капиталу, ликвидности и роли в экосистеме.", "Решающая проверка — удерживает ли токен достаточно ценности при росте L2 и приложений."]},
    conclusions:{ tokenomics:"Баланс выпуска и сжигания показывает, усиливает ли сеть дефицит ETH.", financials:"Комиссии важны как сигнал спроса на расчетный слой Ethereum.", capital:"Глубина TVL и стейблкоинов поддерживает роль ETH как базового актива.", liquidity:"Глубокий рынок упрощает управление позицией, но не решает вопрос value capture.", narrative:"Обновления сети ценны, если усиливают использование и захват ценности ETH."},
  },
  sol: {
    executive:["Solana — инфраструктурная ставка на быстрый рост on-chain экономики.", "Приток капитала и торговый оборот подтверждают скорость развития экосистемы.", "Комиссии должны расти вместе с качеством, а не только количеством активности.", "Главный вопрос — сколько создаваемой ценности остается у SOL."],
    profile:{ strengths:["Высокая скорость экосистемного роста","Сильный on-chain торговый поток","Способность быстро привлекать капитал"], weaknesses:["Экономика зависит от качества активности","Ценность распределяется между приложениями и сетью","Рост должен выдержать смену рыночного цикла"], risks:["Охлаждение торговой активности","Отток быстро привлеченного капитала","Слабый захват ценности базовым слоем"], watch:["Качество притока капитала","Комиссии и устойчивость оборота","Долю ценности, остающуюся у SOL"]},
    verdict:{ title:"Финальная оценка SOL", subtitle:"Растущая инфраструктура: скорость должна перейти в ценность", paragraphs:["SOL выглядит сильнее, когда быстрый рост экосистемы удерживает капитал и создает устойчивые комиссии.", "Инвесторский итог зависит от того, превращается ли активность приложений в ценность базового актива."]},
    conclusions:{ tokenomics:"Спрос на SOL должен перекрывать давление предложения по мере роста сети.", financials:"Качество комиссий важнее рекордного числа дешевых операций.", capital:"Устойчивость притока капитала покажет, насколько рост Solana переживает цикл.", liquidity:"Сильный оборот поддерживает рынок SOL, пока сохраняет глубину при выходе капитала.", narrative:"Темп роста важен, если он превращается в устойчивую экономику базового слоя."},
  },
  doge: {
    executive:["DOGE — зрелый attention-актив с узнаваемым и ликвидным рынком.", "Оборот и доступность выхода важнее попыток искать денежный поток.", "Концентрация крупных держателей остается источником резких движений.", "Главный риск — потеря внимания и быстрый unwind ликвидности."],
    verdict:{ title:"Финальная оценка DOGE", subtitle:"Meme: зрелая ликвидность против цикличности внимания", paragraphs:["DOGE поддерживает тезис узнаваемостью и глубиной рынка, а не фундаментальным доходом.", "Позиция остается зависимой от оборота, концентрации и способности нарратива пережить смену цикла."]},
  },
  pepe: {
    executive:["PEPE — narrative-driven актив, чувствительный к рыночному импульсу.", "Высокий оборот поддерживает рынок, пока внимание остается концентрированным.", "Концентрация усиливает амплитуду движения и риск выхода.", "Главный риск — резкая потеря импульса и ликвидности."],
    verdict:{ title:"Финальная оценка PEPE", subtitle:"Meme: сила импульса против риска его потери", paragraphs:["PEPE остается сильным, пока нарратив удерживает оборот и рыночное внимание.", "Итоговый риск — быстрое схлопывание импульса при продажах крупных держателей или смене нарратива."]},
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
  return {
    market: selectMetricSlots(report, project, "market", 8),
    tokenomics: selectMetricSlots(report, project, "tokenomics", 8),
    financial: selectMetricSlots(report, project, "financial", 3),
    capital: selectMetricSlots(report, project, "capital", 3),
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

  report.meta = { ...(report.meta || {}), project_profile:profile, semantic_profile:profile.category };
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
