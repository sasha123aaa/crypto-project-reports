const BASE_URL="https://api.coingecko.com/api/v3";
export async function fetchCoinGeckoMarket(coingeckoId){
  const url=`${BASE_URL}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coingeckoId)}&price_change_percentage=7d`;
  const res=await fetch(url,{headers:{accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"}});
  if(!res.ok) throw new Error(`CoinGecko market error: ${res.status}`);
  const data=await res.json(); return data?.[0]||null;
}
export async function fetchCoinGeckoChart(coingeckoId,days=365){
  const url=`${BASE_URL}/coins/${encodeURIComponent(coingeckoId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res=await fetch(url,{headers:{accept:"application/json,text/plain,*/*","user-agent":"Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0"}});
  if(!res.ok) throw new Error(`CoinGecko chart error: ${res.status}`);
  return res.json();
}
