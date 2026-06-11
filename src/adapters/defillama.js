const JSON_HEADERS = { accept: "application/json,text/plain,*/*", "user-agent": "Mozilla/5.0 CloudflareWorker CryptoProjectReports/1.0" };

export async function fetchDefiLlamaChains(){ const res=await fetch("https://api.llama.fi/v2/chains"); if(!res.ok) throw new Error(`DefiLlama chains error: ${res.status}`); return res.json(); }
export async function fetchDefiLlamaTVLHistory(chainName){ const res=await fetch(`https://api.llama.fi/charts/${encodeURIComponent(chainName)}`); if(!res.ok) throw new Error(`DefiLlama TVL history error: ${res.status}`); return res.json(); }
export async function fetchStablecoinHistory(chainKey){ const res=await fetch(`https://stablecoins.llama.fi/stablecoincharts/${encodeURIComponent(chainKey)}`); if(!res.ok) throw new Error(`DefiLlama stable history error: ${res.status}`); return res.json(); }
export async function fetchStablecoinChains(){ const res=await fetch("https://stablecoins.llama.fi/stablecoinchains"); if(!res.ok) throw new Error(`DefiLlama stable chains error: ${res.status}`); return res.json(); }
export async function fetchFeesOverview(chainName){ const url=`https://api.llama.fi/overview/fees/${encodeURIComponent(chainName)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyFees`; const res=await fetch(url); if(!res.ok) throw new Error(`DefiLlama fees error: ${res.status}`); return res.json(); }
export async function fetchDexOverview(chainName){ const url=`https://api.llama.fi/overview/dexs/${encodeURIComponent(chainName)}?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume`; const res=await fetch(url); if(!res.ok) throw new Error(`DefiLlama dex error: ${res.status}`); return res.json(); }

export async function fetchDefiLlamaRwaActiveMcap(chainName) {
  const endpoints = [
    "https://api.llama.fi/rwa/chains",
    "https://api.llama.fi/rwa",
  ];
  const errors = [];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers: JSON_HEADERS });
      if (!res.ok) throw new Error(`${res.status}`);
      const value = findRwaChainValue(await res.json(), chainName);
      if (Number.isFinite(value)) return { value, source: "DefiLlama RWA API", updated_at: new Date().toISOString() };
    } catch (error) {
      errors.push(`${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw new Error(`DefiLlama RWA Active Mcap unavailable (${errors.join("; ")})`);
}

function findRwaChainValue(payload, chainName) {
  const target = String(chainName || "").toLowerCase();
  const rows = Array.isArray(payload) ? payload : [payload];
  const queue = [...rows];
  while (queue.length) {
    const row = queue.shift();
    if (!row || typeof row !== "object") continue;
    const name = String(row.name ?? row.chain ?? row.chainName ?? row.label ?? "").toLowerCase();
    if (name === target) {
      const value = Number(row.activeMcap ?? row.active_mcap ?? row.rwaActiveMcap ?? row.totalRwaActiveMcap ?? row.totalActiveMcap);
      if (Number.isFinite(value)) return value;
    }
    Object.values(row).forEach((value) => {
      if (value && typeof value === "object") queue.push(...(Array.isArray(value) ? value : [value]));
    });
  }
  return null;
}
