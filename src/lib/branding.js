export function isHttpsUrl(value) {
  return typeof value === "string" && /^https:\/\//i.test(value);
}

export function extractCoinImageUrls(...coins) {
  return [...new Set(coins.flatMap((coin) => [
    coin?.image?.large,
    coin?.image?.small,
    coin?.image?.thumb,
    coin?.image,
    coin?.large,
    coin?.small,
    coin?.thumb,
  ]).filter(isHttpsUrl))];
}

export function mergeBranding(...sources) {
  const merged = {};
  const iconUrls = [];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    Object.assign(merged, source);
    if (Array.isArray(source.iconUrls)) iconUrls.push(...source.iconUrls.filter(isHttpsUrl));
    if (isHttpsUrl(source.iconUrl)) iconUrls.push(source.iconUrl);
  }
  const uniqueUrls = [...new Set(iconUrls)];
  if (uniqueUrls.length) {
    merged.iconUrl = uniqueUrls[0];
    merged.iconUrls = uniqueUrls;
    merged.iconSource = merged.iconSource || "merged_branding";
  }
  return Object.keys(merged).length ? merged : null;
}

export function brandingFromCoinGeckoAsset(asset, fallback = {}) {
  const iconUrls = extractCoinImageUrls(asset);
  return mergeBranding(fallback, iconUrls.length ? { iconUrl:iconUrls[0], iconUrls, iconSource:"coingecko" } : null);
}
