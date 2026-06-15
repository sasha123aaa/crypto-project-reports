import { STATUS, metric } from "./status.js";
import { formatCompactNumber, formatMoney, formatMultiple, formatPercent, formatPrice } from "./formatters.js";
import { calcAnnualizedFeesToMarketCap, calcMarketCapToTVL, calcStablecoinsToTVL, calcVolumeToMarketCap } from "./calculations.js";
import { getUsersFallbackText } from "./fallbacks.js";
import { fetchCoinGeckoMarket, fetchCoinGeckoChart, fetchProjectNews } from "../adapters/coingecko.js";
import { fetchDefiLlamaChains, fetchDefiLlamaTVLHistory, fetchStablecoinHistory, fetchStablecoinChains, fetchAppFeesOverview, fetchChainFeesOverview, fetchDexOverview, normalizeStablecoinHistory, stablecoinMcapUsd } from "../adapters/defillama.js";
import { getTechnicalBias } from "../adapters/bybit.js";
import { marketTechnicalRoutes } from "./market-symbols.js";
import { getProjectProfile, getSectionSelection } from "../config/projects.js";
import { applySectionSelection, isSectionSelected } from "./section-selection.js";
import { applyProfileAwareSemantics } from "./profile-semantics.js";
import { applyInferredTitleSubtitle } from "./title-subtitle-inference.js";
import { orchestrateReportSources } from "./report-readiness.js";
import { brandingFromCoinGeckoAsset, mergeBranding } from "./branding.js";

function findChainData(chains, chainName){ return Array.isArray(chains) ? chains.find((item)=>String(item.name).toLowerCase()===String(chainName).toLowerCase()) : null; }
function findStableChainData(chains, chainKey){ return Array.isArray(chains) ? chains.find((item)=>String(item.gecko_id || item.name || "").toLowerCase()===String(chainKey).toLowerCase()) : null; }
function lastChartValue(chart, valueKey="totalLiquidityUSD"){ if(!Array.isArray(chart)||chart.length===0) return null; const last=chart[chart.length-1]; return last?.[valueKey] ?? last?.totalLiquidityUSD ?? last?.totalCirculatingUSD ?? null; }

export async function buildReport(project){
  const initialSelection = getSectionSelection(project);
  const selected = (section) => isSectionSelected(initialSelection, section);
  const { results, summary:sourceReadiness } = await orchestrateReportSources([
    { name:"market", critical:true, attempts:3, load:()=>project.coingeckoId ? fetchCoinGeckoMarket(project.coingeckoId) : null, validate:(value)=>{
      const price = Number(value?.current_price); const marketCap = Number(value?.market_cap);
      const fdv = Number(value?.fully_diluted_valuation); const volume = Number(value?.total_volume);
      return Number.isFinite(price) && price > 0 && ((Number.isFinite(marketCap) && marketCap > 0) || (Number.isFinite(fdv) && fdv > 0)) && Number.isFinite(volume) && volume > 0;
    } },
    { name:"price_chart", load:()=>project.coingeckoId ? fetchCoinGeckoChart(project.coingeckoId,365) : null },
    { name:"chains", load:()=>project.defillamaChain && selected("tvl_and_capital") ? fetchDefiLlamaChains() : null },
    { name:"tvl_history", load:()=>project.defillamaChain && selected("tvl_and_capital") ? fetchDefiLlamaTVLHistory(project.defillamaChain) : null },
    { name:"stablecoin_history", load:()=>project.stablecoinChain && selected("stablecoins") ? fetchStablecoinHistory(project.stablecoinChain) : null },
    { name:"stablecoin_chains", load:()=>project.stablecoinChain && selected("stablecoins") ? fetchStablecoinChains() : null },
    { name:"app_fees", load:()=>project.defillamaChain && selected("financials") ? fetchAppFeesOverview(project.defillamaChain) : null },
    { name:"chain_fees", load:()=>project.defillamaChain && selected("financials") ? fetchChainFeesOverview(project.defillamaChain) : null },
    { name:"dex", load:()=>project.defillamaChain && (selected("financials") || selected("liquidity_and_trading")) ? fetchDexOverview(project.defillamaChain) : null },
    { name:"technical_bias", load:()=>getTechnicalBias(marketTechnicalRoutes(project.marketSymbols)) },
    { name:"news", load:()=>selected("narrative_and_news") ? fetchProjectNews(project) : null },
  ]);
  const { market:cgMarket, price_chart:cgChart, chains, tvl_history:tvlHistory, stablecoin_history:stableHistory, stablecoin_chains:stableChains, app_fees:appFees, chain_fees:chainFees, dex, technical_bias:ta, news } = results;

  const market = cgMarket.status==="fulfilled" ? cgMarket.value : null;
  const marketBranding = brandingFromCoinGeckoAsset(market);
  const chart = cgChart.status==="fulfilled" ? cgChart.value : null;
  const chainRows = chains.status==="fulfilled" ? chains.value : null;
  const tvlRows = tvlHistory.status==="fulfilled" ? tvlHistory.value : null;
  const stableRows = stableHistory.status==="fulfilled" ? normalizeStablecoinHistory(stableHistory.value) : [];
  const stableChainRows = stableChains.status==="fulfilled" ? stableChains.value : null;
  const appFeesData = appFees.status==="fulfilled" ? appFees.value : null;
  const chainFeesData = chainFees.status==="fulfilled" ? chainFees.value : null;
  const dexData = dex.status==="fulfilled" ? dex.value : null;
  const taData = ta.status==="fulfilled" ? ta.value : null;
  const newsData = news.status==="fulfilled" ? news.value : null;

  const chainNow = findChainData(chainRows, project.defillamaChain);
  const stableNow = findStableChainData(stableChainRows, project.stablecoinChain);

  const price = market?.current_price ?? null;
  const marketCap = market?.market_cap ?? null;
  const fdv = market?.fully_diluted_valuation ?? null;
  const volume24h = market?.total_volume ?? null;
  const circulatingSupply = market?.circulating_supply ?? null;
  const totalSupply = market?.total_supply ?? null;
  const maxSupply = market?.max_supply ?? null;

  const tvl = chainNow?.tvl ?? lastChartValue(tvlRows) ?? project.runtimeData?.tvl ?? null;
  const stablecoinsMcap = stablecoinMcapUsd(stableNow) ?? lastChartValue(stableRows,"totalCirculatingUSD") ?? null;
  const appFees24h = appFeesData?.total24h ?? null;
  const chainFees24h = chainFeesData?.total24h ?? null;
  const dexVolume24h = dexData?.total24h ?? null;

  const marketCapToTVL = calcMarketCapToTVL(marketCap, tvl);
  const volumeToMarketCap = calcVolumeToMarketCap(volume24h, marketCap);
  const stablecoinsToTVL = calcStablecoinsToTVL(stablecoinsMcap, tvl);
  const annualizedChainFeesToMarketCap = calcAnnualizedFeesToMarketCap(chainFees24h, marketCap);
  const annualizedAppFeesToMarketCap = calcAnnualizedFeesToMarketCap(appFees24h, marketCap);
  const dexVolumeToMarketCap = calcVolumeToMarketCap(dexVolume24h, marketCap);

  const report = {
    meta:{ slug:project.slug, project_name:project.name, ticker:project.ticker, subtitle:project.subtitle, branding:mergeBranding(project.branding, marketBranding), market_symbols:project.marketSymbols || null, categories:project.categories, project_type:project.projectType, project_profile:getProjectProfile(project), project_resolution:project.resolution || null, source_readiness:sourceReadiness, report_version:"v1.0", updated_at:new Date().toISOString(), data_status:"partial" },
    hero:{ title:`${project.name} как базовая инфраструктура рынка`, subtitle:"Сильный фундаментал, зрелость актива и главный вопрос — удержание ценности внутри экосистемы.", lead:`${project.name} остается важным активом для инфраструктурного слоя крипторынка. Главная задача отчета — показать не только рыночный размер, но и качество экономики сети, капитала и пользовательской активности.`, main_strength:"Сильная инфраструктурная позиция, масштаб экосистемы и высокая ликвидность.", main_risk:"Часть ценности может уходить в смежные уровни экосистемы, а не оставаться напрямую в токене.", status_text:"Сильный фундаментал, но дальнейший тезис должен подтверждаться живой экономикой сети." },
    market:{
      price: metric(price, formatPrice(price), price!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      market_cap: metric(marketCap, formatMoney(marketCap), marketCap!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      fdv: metric(fdv, formatMoney(fdv), fdv!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      volume_24h: metric(volume24h, formatMoney(volume24h), volume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      circulating_supply: metric(circulatingSupply, circulatingSupply!=null?formatCompactNumber(circulatingSupply):"данные временно недоступны", circulatingSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"),
      total_supply: metric(totalSupply, totalSupply!=null?formatCompactNumber(totalSupply):"данные временно недоступны", totalSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"),
      max_supply: metric(maxSupply, maxSupply!=null?formatCompactNumber(maxSupply):"Нет", maxSupply!=null?STATUS.LIVE:STATUS.STATIC, maxSupply!=null?"CoinGecko":"project structure"),
    },
    technical_bias: taData,
    executive_summary:{ items:[`${project.name} сохраняет сильную позицию по капиталу, ликвидности и инфраструктурной роли.`,"Главный вопрос для инвестора — насколько экономическая активность поддерживает оценку актива.","Для зрелых активов рынок обычно требует не только бренд, но и подтверждение через метрики сети.","Смотреть нужно не на одну цену, а на экономику, капитал и качество спроса."] },
    profile:{ strengths:["Сильная инфраструктурная позиция","Высокая ликвидность","Понятный рыночный профиль","Масштаб экосистемы"], weaknesses:["Часть метрик может зависеть от методологии источника","Не вся создаваемая ценность обязательно остается в токене","Для зрелых активов рынок строже оценивает замедление роста","Не по всем блокам доступны одинаково надежные данные"], risks:["Ослабление сетевой экономики","Размывание ценности внутри экосистемы","Усиление конкуренции","Замедление роста фундаментальных метрик"], watch:["Динамику комиссий и объемов","Приток капитала и TVL","Пользовательскую активность","Как распределяется ценность внутри экосистемы"] },
    about:{ title:`Что такое ${project.name}`, paragraphs:[`${project.name} — это криптопроект, который нужно оценивать не только по цене токена, но и по его роли в экосистеме.`,"Для сильного инвестиционного тезиса важно понимать, решает ли проект реальную задачу и подтверждается ли это цифрами.","Поэтому в отчете делается акцент на токеномику, экономику, капитал, активность и риски."] },
    tokenomics:{ text:["Токеномика должна отвечать на вопрос, есть ли давление предложения и насколько структура актива здорова.","Если часть supply недоступна или спорна по источникам, это нужно отмечать прямо."], metrics:{ market_cap:metric(marketCap, formatMoney(marketCap), marketCap!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"), fdv:metric(fdv, formatMoney(fdv), fdv!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"), circulating_supply:metric(circulatingSupply, circulatingSupply!=null?formatCompactNumber(circulatingSupply):"данные временно недоступны", circulatingSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"), total_supply:metric(totalSupply, totalSupply!=null?formatCompactNumber(totalSupply):"данные временно недоступны", totalSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"), max_supply:metric(maxSupply, maxSupply!=null?formatCompactNumber(maxSupply):"Нет", maxSupply!=null?STATUS.LIVE:STATUS.STATIC, maxSupply!=null?"CoinGecko":"project structure") } },
    financials:{ text:["Этот блок показывает, есть ли у проекта реальная экономика и насколько она поддерживает инвестиционный тезис.","Важно смотреть не только на комиссии, но и на устойчивость экономической активности."], metrics:{ app_fees_24h:metric(appFees24h, formatMoney(appFees24h), appFees24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), chain_fees_24h:metric(chainFees24h, formatMoney(chainFees24h), chainFees24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), dex_volume_24h:metric(dexVolume24h, formatMoney(dexVolume24h), dexVolume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), volume_market_cap:metric(volumeToMarketCap, formatPercent(volumeToMarketCap), volumeToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc") } },
    capital:{ text:["Капитал внутри экосистемы показывает уровень доверия рынка к проекту.","Особенно важно смотреть, есть ли стабильность или заметный отток капитала."], metrics:{ tvl:metric(tvl, formatMoney(tvl), tvl!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), stablecoins_mcap:metric(stablecoinsMcap, formatMoney(stablecoinsMcap), stablecoinsMcap!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama") } },
    users:{ text:getUsersFallbackText(project), metrics:{ daily_active_addresses:metric(null, "—", STATUS.UNAVAILABLE, "Dune"), new_addresses:metric(null, "—", STATUS.UNAVAILABLE, "Dune"), transactions:metric(null, "—", STATUS.UNAVAILABLE, "Dune") } },
    liquidity:{ text:["Ликвидность показывает, насколько удобно крупному и среднему капиталу входить и выходить из позиции.","Для зрелого актива это один из ключевых плюсов, потому что снижает риск тонкого рынка."], metrics:{ spot_volume:metric(volume24h, formatMoney(volume24h), volume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"), dex_volume_24h:metric(dexVolume24h, formatMoney(dexVolume24h), dexVolume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama") } },
    valuation:{ text:["Оценка актива должна подтверждаться фундаментальными метриками, а не только динамикой цены.","Чем зрелее актив, тем важнее смотреть на мультипликаторы и качество экономики."], metrics:{ market_cap_tvl:metric(marketCapToTVL, formatMultiple(marketCapToTVL), marketCapToTVL!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), volume_market_cap:metric(volumeToMarketCap, formatPercent(volumeToMarketCap), volumeToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), stablecoins_tvl:metric(stablecoinsToTVL, formatMultiple(stablecoinsToTVL), stablecoinsToTVL!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), annualized_chain_fees_market_cap:metric(annualizedChainFeesToMarketCap, formatPercent(annualizedChainFeesToMarketCap), annualizedChainFeesToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), annualized_app_fees_market_cap:metric(annualizedAppFeesToMarketCap, formatPercent(annualizedAppFeesToMarketCap), annualizedAppFeesToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), dex_volume_market_cap:metric(dexVolumeToMarketCap, formatPercent(dexVolumeToMarketCap), dexVolumeToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), valuation_status:metric(null, "зрелый актив", STATUS.MANUAL, "analyst") } },
    narrative:{ items:["Рынок поддерживает интерес к проектам, которые сохраняют подтверждаемую полезность и ликвидность.","Для сильного тезиса важно, чтобы нарратив подтверждался доступными данными, а пробелы не скрывались."] },
    ...(newsData ? { news:newsData } : {}),
    risks:{ items:["Ослабление сетевой экономики.","Слабый рост ключевых фундаментальных метрик.","Конкуренция со стороны других проектов.","Разрыв между рыночной оценкой и реальной экономикой."] },
    watchlist:{ items:["Динамику комиссий и объемов.","TVL и капитал внутри экосистемы.","Пользовательскую активность.","Изменение мультипликаторов оценки."] },
    final_verdict:{ title:"Финальная оценка", subtitle:"Инвестиционный тезис: фундаментальные метрики должны подтверждать оценку", paragraphs:[`${project.name} выглядит как сильный проект для фундаментального наблюдения, если смотреть на рынок не только через цену.`,"Главный вопрос для инвестора — подтверждают ли экономические и пользовательские метрики рыночную оценку.","Сильный тезис строится там, где цена, экономика, капитал и живая активность не противоречат друг другу."] },
    charts:{ price_history:chart?.prices || [], volume_history:chart?.total_volumes || [], market_cap_history:chart?.market_caps || [], tvl_history:Array.isArray(tvlRows)?tvlRows:[], stablecoins_history:Array.isArray(stableRows)?stableRows:[], app_fees_history:appFeesData?.totalDataChart || [], chain_fees_history:chainFeesData?.totalDataChart || [], dex_history:dexData?.totalDataChart || [] },
    sources:[{name:"CoinGecko", used_for:["price","market cap","fdv","volume"]},{name:"DefiLlama", used_for:["tvl","stablecoins","fees","dex volume"]},{name:"Bybit / Binance / Gate.io", used_for:["exchange-aware technical bias"]}]
  };
  applyProfileAwareSemantics(report, project, { preserveCurated:Boolean(project.reportOptions?.preserveCuratedSemantics) });
  applyInferredTitleSubtitle(report, project);
  applySectionSelection(report, project);
  const marketAttempts = results.market?.attempts || 1;
  report.meta.source_state = results.market?.status === "fulfilled"
    ? (marketAttempts > 1 ? "retry-live" : "live")
    : "partial";
  return report;
}
