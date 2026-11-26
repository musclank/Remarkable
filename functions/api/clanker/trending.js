const json = (data, status, origin, cache = "no-store") => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Cache-Control": cache
  }
});

const getJson = async (url) => {
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Remarkable-Token-Explorer/1.0" },
    cf: { cacheTtl: 20, cacheEverything: true }
  });
  if (!response.ok) throw new Error("Upstream returned " + response.status);
  return response.json();
};

const extractTokens = (payload) => {
  if (Array.isArray(payload)) return payload;
  return payload?.tokens || payload?.data?.tokens || payload?.data || payload?.results || payload?.pools || [];
};

export async function onRequest({ request }) {
  const origin = new URL(request.url).origin;
  let clankerError = "";
  try {
    const clanker = await getJson("https://www.clanker.world/api/tokens/trending");
    const tokens = extractTokens(clanker);
    if (Array.isArray(tokens) && tokens.length) {
      return json({ source: "Clanker", tokens: tokens.slice(0, 20) }, 200, origin, "public, max-age=15, s-maxage=20");
    }
    clankerError = "Clanker returned no token records";
  } catch (error) {
    clankerError = String(error?.message || error);
  }

  try {
    const [boosts, profiles] = await Promise.all([
      getJson("https://api.dexscreener.com/token-boosts/latest/v1").catch(() => []),
      getJson("https://api.dexscreener.com/token-profiles/latest/v1").catch(() => [])
    ]);
    const discovered = [...(Array.isArray(boosts) ? boosts : []), ...(Array.isArray(profiles) ? profiles : [])];
    const unique = new Map();
    for (const item of discovered) {
      if (item?.chainId && item?.tokenAddress) {
        const key = item.chainId + ":" + item.tokenAddress.toLowerCase();
        if (!unique.has(key)) unique.set(key, item);
      }
    }
    const groups = new Map();
    for (const item of unique.values()) {
      if (!groups.has(item.chainId)) groups.set(item.chainId, []);
      groups.get(item.chainId).push(item);
    }
    const pairs = [];
    for (const [chainId, items] of groups) {
      for (let i = 0; i < items.length; i += 30) {
        const batch = items.slice(i, i + 30);
        const addresses = batch.map(item => item.tokenAddress).join(",");
        const result = await getJson("https://api.dexscreener.com/tokens/v1/" + encodeURIComponent(chainId) + "/" + encodeURIComponent(addresses)).catch(() => []);
        if (!Array.isArray(result)) continue;
        for (const pair of result) {
          const address = pair?.baseToken?.address?.toLowerCase();
          const metadata = batch.find(item => item.tokenAddress.toLowerCase() === address);
          if (metadata) pairs.push({ ...pair, description: metadata.description || "", info: pair.info || { imageUrl: metadata.icon }, profileUrl: metadata.url, type: "Trending" });
        }
      }
    }
    const bestByToken = new Map();
    for (const pair of pairs) {
      const key = pair.baseToken?.address?.toLowerCase();
      if (!key) continue;
      const liquidity = Number(pair.liquidity?.usd || 0);
      if (!bestByToken.has(key) || liquidity > Number(bestByToken.get(key).liquidity?.usd || 0)) bestByToken.set(key, pair);
    }
    const tokens = [...bestByToken.values()].sort((a, b) => Number(b.volume?.h24 || 0) - Number(a.volume?.h24 || 0)).slice(0, 20);
    if (tokens.length) {
      return json({ source: "DexScreener", tokens, fallbackReason: clankerError }, 200, origin, "public, max-age=20, s-maxage=30");
    }
    return json({ error: "Clanker and DexScreener did not return live market tokens", detail: clankerError }, 502, origin);
  } catch (error) {
    return json({ error: "Live Clanker and DexScreener feeds are unavailable", detail: String(error?.message || error), clankerError }, 502, origin);
  }
}
