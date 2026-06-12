const FARSIDE_BTC_ALL_DATA_URL = "https://farside.co.uk/bitcoin-etf-flow-all-data/";
const DAY_MS = 86_400_000;

function stripHtml(value) {
  return String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseFlowMillions(value) {
  const text = stripHtml(value).replace(/[$,]/g, "").trim();
  if (!text || text === "-" || /^n\/?a$/i.test(text)) return null;
  const negative = /^\(.*\)$/.test(text);
  const number = Number(text.replace(/[()]/g, ""));
  return Number.isFinite(number) ? (negative ? -number : number) : null;
}

function parseFarsideDate(value) {
  const match = stripHtml(value).match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/);
  if (!match) return null;
  const timestamp = Date.parse(`${match[1]} ${match[2]} ${match[3]} 00:00:00 UTC`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function parseBitcoinEtfFlowHtml(html) {
  const rows = [];
  for (const rowMatch of String(html || "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1]);
    const timestamp = parseFarsideDate(cells[0]);
    const totalMillions = parseFlowMillions(cells.at(-1));
    if (timestamp !== null && totalMillions !== null) rows.push([timestamp, totalMillions * 1_000_000]);
  }
  return rows.sort((a, b) => a[0] - b[0]);
}

export async function fetchBitcoinEtfFlows({ days = 365 } = {}) {
  const response = await fetch(FARSIDE_BTC_ALL_DATA_URL, {
    headers: { accept: "text/html", "user-agent": "CryptoProjectReports/1.0" },
  });
  if (!response.ok) throw new Error(`Farside Bitcoin ETF flows error: ${response.status}`);
  const allDaily = parseBitcoinEtfFlowHtml(await response.text());
  if (!allDaily.length) throw new Error("Farside Bitcoin ETF flows returned no daily totals");

  let cumulative = 0;
  const cumulativeAll = allDaily.map(([timestamp, flow]) => [timestamp, cumulative += flow]);
  const cutoff = Date.now() - days * DAY_MS;
  const daily = allDaily.filter(([timestamp]) => timestamp >= cutoff);
  const cumulativeHistory = cumulativeAll.filter(([timestamp]) => timestamp >= cutoff);
  const latest = allDaily.at(-1);
  const recentFiveDayNet = allDaily.slice(-5).reduce((sum, [, flow]) => sum + flow, 0);

  return {
    current: {
      latestNetFlow: latest[1],
      recentFiveDayNet,
      cumulativeNetFlow: cumulativeAll.at(-1)[1],
      updatedAt: new Date(latest[0]).toISOString(),
    },
    charts: { daily, cumulative: cumulativeHistory },
    source: "Farside Investors",
  };
}
