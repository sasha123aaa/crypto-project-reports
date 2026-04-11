import { STATUS, metric } from "./status.js";
import { formatMoney, formatMultiple, formatPercent } from "./formatters.js";
import { calcMarketCapToTVL, calcStablecoinsToTVL, calcVolumeToMarketCap } from "./calculations.js";
import { getUsersFallbackText } from "./fallbacks.js";
import { fetchCoinGeckoMarket, fetchCoinGeckoChart } from "../adapters/coingecko.js";
import { fetchDefiLlamaChains, fetchDefiLlamaTVLHistory, fetchStablecoinHistory, fetchStablecoinChains, fetchFeesOverview, fetchDexOverview } from "../adapters/defillama.js";
import { getTechnicalBias } from "../adapters/bybit.js";

function findChainData(chains, chainName){ return Array.isArray(chains) ? chains.find((item)=>String(item.name).toLowerCase()===String(chainName).toLowerCase()) : null; }
function findStableChainData(chains, chainKey){ return Array.isArray(chains) ? chains.find((item)=>String(item.gecko_id || item.name || "").toLowerCase()===String(chainKey).toLowerCase()) : null; }
function lastChartValue(chart, valueKey="totalLiquidityUSD"){ if(!Array.isArray(chart)||chart.length===0) return null; const last=chart[chart.length-1]; return last?.[valueKey] ?? last?.totalLiquidityUSD ?? last?.totalCirculatingUSD ?? null; }

export async function buildReport(project){
  const [cgMarket,cgChart,chains,tvlHistory,stableHistory,stableChains,fees,dex,ta] = await Promise.allSettled([
    fetchCoinGeckoMarket(project.coingeckoId),
    fetchCoinGeckoChart(project.coingeckoId,365),
    project.defillamaChain ? fetchDefiLlamaChains() : Promise.resolve(null),
    project.defillamaChain ? fetchDefiLlamaTVLHistory(project.defillamaChain) : Promise.resolve(null),
    project.stablecoinChain ? fetchStablecoinHistory(project.stablecoinChain) : Promise.resolve(null),
    project.stablecoinChain ? fetchStablecoinChains() : Promise.resolve(null),
    project.defillamaChain ? fetchFeesOverview(project.defillamaChain) : Promise.resolve(null),
    project.defillamaChain ? fetchDexOverview(project.defillamaChain) : Promise.resolve(null),
    getTechnicalBias(project.bybitSymbol),
  ]);

  const market = cgMarket.status==="fulfilled" ? cgMarket.value : null;
  const chart = cgChart.status==="fulfilled" ? cgChart.value : null;
  const chainRows = chains.status==="fulfilled" ? chains.value : null;
  const tvlRows = tvlHistory.status==="fulfilled" ? tvlHistory.value : null;
  const stableRows = stableHistory.status==="fulfilled" ? stableHistory.value : null;
  const stableChainRows = stableChains.status==="fulfilled" ? stableChains.value : null;
  const feesData = fees.status==="fulfilled" ? fees.value : null;
  const dexData = dex.status==="fulfilled" ? dex.value : null;
  const taData = ta.status==="fulfilled" ? ta.value : null;

  const chainNow = findChainData(chainRows, project.defillamaChain);
  const stableNow = findStableChainData(stableChainRows, project.stablecoinChain);

  const price = market?.current_price ?? null;
  const marketCap = market?.market_cap ?? null;
  const fdv = market?.fully_diluted_valuation ?? null;
  const volume24h = market?.total_volume ?? null;
  const circulatingSupply = market?.circulating_supply ?? null;
  const totalSupply = market?.total_supply ?? null;
  const maxSupply = market?.max_supply ?? null;

  const tvl = chainNow?.tvl ?? lastChartValue(tvlRows) ?? null;
  const stablecoinsMcap = stableNow?.totalCirculatingUSD ?? lastChartValue(stableRows,"totalCirculatingUSD") ?? null;
  const chainFees24h = feesData?.total24h ?? null;
  const dexVolume24h = dexData?.total24h ?? null;

  const marketCapToTVL = calcMarketCapToTVL(marketCap, tvl);
  const volumeToMarketCap = calcVolumeToMarketCap(volume24h, marketCap);
  const stablecoinsToTVL = calcStablecoinsToTVL(stablecoinsMcap, tvl);

  return {
    meta:{ slug:project.slug, project_name:project.name, ticker:project.ticker, subtitle:project.subtitle, categories:project.categories, project_type:project.projectType, report_version:"v1.0", updated_at:new Date().toISOString(), data_status:"partial" },
    hero:{ title:`${project.name} как базовая инфраструктура рынка`, subtitle:"Сильный фундаментал, зрелость актива и главный вопрос — удержание ценности внутри экосистемы.", lead:`${project.name} остается важным активом для инфраструктурного слоя крипторынка. Главная задача отчета — показать не только рыночный размер, но и качество экономики сети, капитала и пользовательской активности.`, main_strength:"Сильная инфраструктурная позиция, масштаб экосистемы и высокая ликвидность.", main_risk:"Часть ценности может уходить в смежные уровни экосистемы, а не оставаться напрямую в токене.", status_text:"Сильный фундаментал, но дальнейший тезис должен подтверждаться живой экономикой сети." },
    market:{
      price: metric(price, formatMoney(price), price!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      market_cap: metric(marketCap, formatMoney(marketCap), marketCap!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      fdv: metric(fdv, formatMoney(fdv), fdv!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      volume_24h: metric(volume24h, formatMoney(volume24h), volume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"),
      circulating_supply: metric(circulatingSupply, circulatingSupply!=null?circulatingSupply.toLocaleString("ru-RU"):"данные временно недоступны", circulatingSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"),
      total_supply: metric(totalSupply, totalSupply!=null?totalSupply.toLocaleString("ru-RU"):"данные временно недоступны", totalSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"),
      max_supply: metric(maxSupply, maxSupply!=null?maxSupply.toLocaleString("ru-RU"):"Нет", maxSupply!=null?STATUS.LIVE:STATUS.MANUAL, maxSupply!=null?"CoinGecko":"project structure"),
    },
    technical_bias: taData,
    executive_summary:{ items:[`${project.name} сохраняет сильную позицию по капиталу, ликвидности и инфраструктурной роли.`,"Главный вопрос для инвестора — насколько экономическая активность поддерживает оценку актива.","Для зрелых активов рынок обычно требует не только бренд, но и подтверждение через метрики сети.","Смотреть нужно не на одну цену, а на экономику, капитал и качество спроса."] },
    profile:{ strengths:["Сильная инфраструктурная позиция","Высокая ликвидность","Понятный рыночный профиль","Масштаб экосистемы"], weaknesses:["Часть метрик может зависеть от методологии источника","Не вся создаваемая ценность обязательно остается в токене","Для зрелых активов рынок строже оценивает замедление роста","Не по всем блокам доступны одинаково надежные данные"], risks:["Ослабление сетевой экономики","Размывание ценности внутри экосистемы","Усиление конкуренции","Замедление роста фундаментальных метрик"], watch:["Динамику комиссий и объемов","Приток капитала и TVL","Пользовательскую активность","Как распределяется ценность внутри экосистемы"] },
    about:{ title:`Что такое ${project.name}`, paragraphs:[`${project.name} — это криптопроект, который нужно оценивать не только по цене токена, но и по его роли в экосистеме.`,"Для сильного инвестиционного тезиса важно понимать, решает ли проект реальную задачу и подтверждается ли это цифрами.","Поэтому в отчете делается акцент на токеномику, экономику, капитал, активность и риски."] },
    tokenomics:{ text:["Токеномика должна отвечать на вопрос, есть ли давление предложения и насколько структура актива здорова.","Если часть supply недоступна или спорна по источникам, это нужно отмечать прямо."], metrics:{ market_cap:metric(marketCap, formatMoney(marketCap), marketCap!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"), fdv:metric(fdv, formatMoney(fdv), fdv!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"), circulating_supply:metric(circulatingSupply, circulatingSupply!=null?circulatingSupply.toLocaleString("ru-RU"):"данные временно недоступны", circulatingSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"), total_supply:metric(totalSupply, totalSupply!=null?totalSupply.toLocaleString("ru-RU"):"данные временно недоступны", totalSupply!=null?STATUS.LIVE:STATUS.PARTIAL, "CoinGecko"), max_supply:metric(maxSupply, maxSupply!=null?maxSupply.toLocaleString("ru-RU"):"Нет", maxSupply!=null?STATUS.LIVE:STATUS.MANUAL, maxSupply!=null?"CoinGecko":"project structure") } },
    financials:{ text:["Этот блок показывает, есть ли у проекта реальная экономика и насколько она поддерживает инвестиционный тезис.","Важно смотреть не только на комиссии, но и на устойчивость экономической активности."], metrics:{ chain_fees_24h:metric(chainFees24h, formatMoney(chainFees24h), chainFees24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), dex_volume_24h:metric(dexVolume24h, formatMoney(dexVolume24h), dexVolume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), volume_market_cap:metric(volumeToMarketCap, formatPercent(volumeToMarketCap), volumeToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc") } },
    capital:{ text:["Капитал внутри экосистемы показывает уровень доверия рынка к проекту.","Особенно важно смотреть, есть ли стабильность или заметный отток капитала."], metrics:{ tvl:metric(tvl, formatMoney(tvl), tvl!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama"), stablecoins_mcap:metric(stablecoinsMcap, formatMoney(stablecoinsMcap), stablecoinsMcap!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama") } },
    users:{ text:getUsersFallbackText(project), metrics:{ daily_active_addresses:metric(null, "—", STATUS.UNAVAILABLE, "Dune"), new_addresses:metric(null, "—", STATUS.UNAVAILABLE, "Dune"), transactions:metric(null, "—", STATUS.UNAVAILABLE, "Dune") } },
    liquidity:{ text:["Ликвидность показывает, насколько удобно крупному и среднему капиталу входить и выходить из позиции.","Для зрелого актива это один из ключевых плюсов, потому что снижает риск тонкого рынка."], metrics:{ spot_volume:metric(volume24h, formatMoney(volume24h), volume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "CoinGecko"), dex_volume_24h:metric(dexVolume24h, formatMoney(dexVolume24h), dexVolume24h!=null?STATUS.LIVE:STATUS.UNAVAILABLE, "DefiLlama") } },
    valuation:{ text:["Оценка актива должна подтверждаться фундаментальными метриками, а не только динамикой цены.","Чем зрелее актив, тем важнее смотреть на мультипликаторы и качество экономики."], metrics:{ market_cap_tvl:metric(marketCapToTVL, formatMultiple(marketCapToTVL), marketCapToTVL!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), volume_market_cap:metric(volumeToMarketCap, formatPercent(volumeToMarketCap), volumeToMarketCap!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), stablecoins_tvl:metric(stablecoinsToTVL, formatMultiple(stablecoinsToTVL), stablecoinsToTVL!=null?STATUS.CALCULATED:STATUS.UNAVAILABLE, "calc"), valuation_status:metric(null, "зрелый актив", STATUS.MANUAL, "analyst") } },
    narrative:{ items:["Рынок поддерживает интерес к проектам, которые сохраняют реальную инфраструктурную роль.","Для сильного тезиса важно, чтобы нарратив подтверждался полезностью, активностью и капиталом."] },
    risks:{ items:["Ослабление сетевой экономики.","Слабый рост ключевых фундаментальных метрик.","Конкуренция со стороны других проектов.","Разрыв между рыночной оценкой и реальной экономикой."] },
    watchlist:{ items:["Динамику комиссий и объемов.","TVL и капитал внутри экосистемы.","Пользовательскую активность.","Изменение мультипликаторов оценки."] },
    final_verdict:{ title:`Финальная оценка ${project.ticker}`, subtitle:"Итоговая картина по активу", paragraphs:[`${project.name} выглядит как сильный проект для фундаментального наблюдения, если смотреть на рынок не только через цену.`,"Главный вопрос для инвестора — подтверждают ли экономические и пользовательские метрики рыночную оценку.","Сильный тезис строится там, где цена, экономика, капитал и живая активность не противоречат друг другу."] },
    charts:{ price_history:chart?.prices || [], tvl_history:Array.isArray(tvlRows)?tvlRows:[], stablecoins_history:Array.isArray(stableRows)?stableRows:[], fees_history:feesData?.totalDataChart || [], dex_history:dexData?.totalDataChart || [] },
    sources:[{name:"CoinGecko", used_for:["price","market cap","fdv","volume"]},{name:"DefiLlama", used_for:["tvl","stablecoins","fees","dex volume"]},{name:"Bybit", used_for:["technical bias"]}]
  };
}
