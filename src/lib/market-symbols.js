export const MARKET_EXCHANGE_PRIORITY = Object.freeze(["BYBIT", "BINANCE", "GATEIO"]);

const EXCHANGE_LABELS = Object.freeze({
  BYBIT: "Bybit spot",
  BINANCE: "Binance spot",
  GATEIO: "Gate.io spot",
});

function cleanTicker(value) {
  const ticker = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return ticker || null;
}

function routeFor(exchange, symbol) {
  return { exchange, symbol, tradingView:`${exchange}:${symbol}`, source:EXCHANGE_LABELS[exchange] || `${exchange} spot` };
}

export function createMarketSymbols(ticker, { quote = "USDT", exchanges = MARKET_EXCHANGE_PRIORITY } = {}) {
  const base = cleanTicker(ticker);
  const cleanQuote = cleanTicker(quote);
  if (!base || !cleanQuote) {
    return { base:null, quote:cleanQuote, exchange:null, tradingView:null, technical:null, routes:[], status:"unavailable" };
  }

  const symbol = `${base}${cleanQuote}`;
  const routes = exchanges.map((exchange) => routeFor(exchange, symbol));
  const selected = routes[0] || null;
  return {
    base,
    quote:cleanQuote,
    exchange:selected?.exchange || null,
    tradingView:selected?.tradingView || null,
    technical:selected?.symbol || null,
    routes,
    status:selected ? "candidate" : "unavailable",
  };
}

async function checkRouteAvailability(route) {
  const endpoints = {
    BYBIT: `https://api.bybit.com/v5/market/instruments-info?category=spot&symbol=${encodeURIComponent(route.symbol)}`,
    BINANCE: `https://api.binance.com/api/v3/exchangeInfo?symbol=${encodeURIComponent(route.symbol)}`,
    GATEIO: `https://api.gateio.ws/api/v4/spot/currency_pairs/${encodeURIComponent(`${route.symbol.slice(0, -4)}_${route.symbol.slice(-4)}`)}`,
  };
  const url = endpoints[route.exchange];
  if (!url) return false;
  const response = await fetch(url, { signal:AbortSignal.timeout(3500) });
  if (!response.ok) return false;
  const json = await response.json();
  if (route.exchange === "BYBIT") return Array.isArray(json?.result?.list) && json.result.list.some((row) => row?.symbol === route.symbol && row?.status === "Trading");
  if (route.exchange === "BINANCE") return Array.isArray(json?.symbols) && json.symbols.some((row) => row?.symbol === route.symbol && row?.status === "TRADING");
  if (route.exchange === "GATEIO") return json?.id === `${route.symbol.slice(0, -4)}_${route.symbol.slice(-4)}` && json?.trade_status === "tradable";
  return false;
}

export async function resolveExchangeMarketSymbols(marketSymbols, checkAvailability = checkRouteAvailability) {
  const routes = Array.isArray(marketSymbols?.routes) ? marketSymbols.routes : [];
  const availability = await Promise.all(routes.map(async (route) => {
    try {
      return await checkAvailability(route);
    } catch {
      return false;
    }
  }));
  const route = routes.find((candidate, index) => availability[index]);
  if (route) return { ...marketSymbols, exchange:route.exchange, tradingView:route.tradingView, technical:route.symbol, status:"resolved" };
  return { ...marketSymbols, exchange:null, tradingView:null, technical:null, status:"unavailable" };
}

export function marketTechnicalRoute(marketSymbols) {
  if (!marketSymbols?.exchange || !marketSymbols?.technical) return null;
  return {
    exchange:marketSymbols.exchange,
    symbol:marketSymbols.technical,
    source:EXCHANGE_LABELS[marketSymbols.exchange] || `${marketSymbols.exchange} spot`,
  };
}
