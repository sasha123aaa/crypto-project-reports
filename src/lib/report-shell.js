import { fetchCoinGeckoMarket } from "../adapters/coingecko.js";
import { metric } from "./status.js";
import { formatMoney, formatPrice } from "./formatters.js";
import { brandingFromCoinGeckoAsset, mergeBranding } from "./branding.js";
import { publishReportReadiness } from "./report-readiness.js";

function withSoftTimeout(promise, timeoutMs = 4500) {
  return Promise.race([promise.catch(() => null), new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))]);
}

export async function buildReportShell(project) {
  const market = project.coingeckoId ? await withSoftTimeout(fetchCoinGeckoMarket(project.coingeckoId)) : null;
  const price = Number(market?.current_price), marketCap = Number(market?.market_cap), fdv = Number(market?.fully_diluted_valuation), volume24h = Number(market?.total_volume);
  const hasPrice = Number.isFinite(price) && price > 0, hasMarketCap = Number.isFinite(marketCap) && marketCap > 0, hasFdv = Number.isFinite(fdv) && fdv > 0, hasVolume = Number.isFinite(volume24h) && volume24h > 0;
  const now = new Date().toISOString();
  const report = {
    meta:{ slug:project.slug, project_name:project.name, ticker:project.ticker, subtitle:project.subtitle || project.ticker, branding:mergeBranding(project.branding, brandingFromCoinGeckoAsset(market)), market_symbols:project.marketSymbols || null, categories:project.categories || [], project_type:project.projectType || null, project_profile:project.projectProfile || null, project_resolution:project.resolution || null, data_status:hasPrice ? "shell-market" : "shell-meta-only", source_state:hasPrice ? "shell" : "shell-partial", updated_at:now, generated_at:now, progressive:true, loading_sections:["technical_bias","charts","financials","tvl_and_capital","users_and_activity","narrative_and_news"] },
    hero:{ title:project.name, subtitle:project.subtitle || project.ticker, lead:hasPrice ? `Базовый отчет по ${project.name} открыт. Расширенные метрики подгружаются в фоне.` : `Страница ${project.name} открыта. Рыночные данные подгружаются.`, main_strength:"Базовые данные проекта определены.", main_risk:"Часть источников еще загружается или временно недоступна.", status_text:"Расширенные метрики появятся после фоновой загрузки." },
    market:{ price:metric(hasPrice ? price : null, hasPrice ? formatPrice(price) : "загружается", hasPrice ? "live" : "partial", "CoinGecko"), market_cap:metric(hasMarketCap ? marketCap : null, hasMarketCap ? formatMoney(marketCap) : "загружается", hasMarketCap ? "live" : "partial", "CoinGecko"), fdv:metric(hasFdv ? fdv : null, hasFdv ? formatMoney(fdv) : "загружается", hasFdv ? "live" : "partial", "CoinGecko"), volume_24h:metric(hasVolume ? volume24h : null, hasVolume ? formatMoney(volume24h) : "загружается", hasVolume ? "live" : "partial", "CoinGecko") },
    charts:{ price_history:[], volume_history:[], market_cap_history:[], tvl_history:[], stablecoins_history:[], app_fees_history:[], chain_fees_history:[], dex_history:[] }, technical_bias:null,
    executive_summary:{ items:["Базовая страница открыта.","Расширенные данные подгружаются в фоне.","Если часть источников недоступна, отчет останется в частичном режиме."] },
    profile:{ strengths:["Проект определен","Базовые рыночные данные загружаются"], weaknesses:["Не все источники могут быть доступны сразу"], risks:["Часть метрик может появиться позже"], watch:["Цена","Капитализация","Объем","TVL","выручка","активность"] },
    final_verdict:{ subtitle:"Предварительный режим", paragraphs:["Отчет открыт в базовом режиме. Данные будут дополнены после фоновой загрузки."] }, news:{ status:"loading", items:[], source_summary:"Новости подгружаются." }
  };
  publishReportReadiness(report, project, { critical:["project_resolution","market"], optional:["charts","technical_bias","financials","tvl","users","news"], failedCritical:[], failedOptional:[] });
  return report;
}
