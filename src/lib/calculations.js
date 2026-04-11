export function safeDivide(a,b){ if(a==null||b==null||b===0) return null; return a/b; }
export function calcMarketCapToTVL(marketCap,tvl){ return safeDivide(marketCap,tvl); }
export function calcVolumeToMarketCap(volume24h,marketCap){ const ratio=safeDivide(volume24h,marketCap); return ratio==null?null:ratio*100; }
export function calcStablecoinsToTVL(stablecoins,tvl){ return safeDivide(stablecoins,tvl); }
