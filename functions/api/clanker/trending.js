
const fetchBaseDexTokens = async () => {
  const [boosts, profiles, clanker, searchResults] = await Promise.all([
    getJson("https://api.dexscreener.com/token-boosts/latest/v1").catch(() => []),
    getJson("https://api.dexscreener.com/token-profiles/latest/v1").catch(() => []),
    getJson("https://www.clanker.world/api/tokens/trending").catch(() => null),
    Promise.all(["base","clanker","degen","higher","brett","toshi","aero","virtual","weth","usdc","higher","based"].map(q =>
      getJson("https://api.dexscreener.com/latest/dex/search?q=" + encodeURIComponent(q)).catch(() => null)
    ))
  ]);

  const clankerItems = extractTokens(clanker);
  const discovered = [...(Array.isArray(boosts) ? boosts : []), ...(Array.isArray(profiles) ? profiles : [])]
    .filter(item => isBase(item) && item?.tokenAddress);
  const unique = new Map();
  for (const item of discovered) unique.set(String(item.tokenAddress).toLowerCase(), item);

  const pairs = searchResults.flatMap(result => Array.isArray(result?.pairs) ? result.pairs : [])
    .filter(pair => String(pair?.chainId).toLowerCase() === "base");
  const metadata = [...unique.values()];
  for (let i = 0; i < metadata.length; i += 25) {
    const batch = metadata.slice(i, i + 25);
    const addresses = batch.map(item => item.tokenAddress).join(",");
    const response = await getJson("https://api.dexscreener.com/tokens/v1/base/" + encodeURIComponent(addresses)).catch(() => []);
    if (!Array.isArray(response)) continue;
    for (const pair of response) {
      if (String(pair?.chainId).toLowerCase() !== "base") continue;
      const address = String(pair?.baseToken?.address || "").toLowerCase();
      const meta = batch.find(item => String(item.tokenAddress).toLowerCase() === address);
      if (meta) pairs.push({ ...pair, chain: "BASE", chainId: "base", description: meta.description || "", info: pair.info || { imageUrl: meta.icon }, type: "Trending" });
    }
  }

  const best = new Map();
  for (const pair of pairs) {
    const address = String(pair?.baseToken?.address || "").toLowerCase();
    if (!address) continue;
    const current = best.get(address);
    if (!current || Number(pair.liquidity?.usd || 0) > Number(current.liquidity?.usd || 0)) best.set(address, pair);
  }
  const dexTokens = [...best.values()].map(pair => ({ ...pair, chain: "BASE", chainId: "base" }));
  const clankerBase = clankerItems.filter(item => isBase(item)).map(item => ({ ...item, chain: "BASE", chainId: "base" }));
  const merged = new Map();
  for (const item of [...clankerBase, ...dexTokens]) {
    const address = String(item?.baseToken?.address || item?.tokenAddress || item?.address || "").toLowerCase();
    if (address) merged.set(address, item);
  }
  return [...merged.values()]
    .sort((a, b) => Number(b.volume?.h24 || b.volume24h || 0) - Number(a.volume?.h24 || a.volume24h || 0))
    .slice(0, 20);
};

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
  const candidates = [payload?.tokens, payload?.data?.tokens, payload?.data, payload?.results, payload?.pools, payload?.pairs];
  return candidates.find(Array.isArray) || [];
};

const isBase = value => {
  const chain = String(value?.chainId || value?.chain || value?.network || value?.chainName || "").toLowerCase();
  return chain === "base" || chain === "8453" || chain.includes("base mainnet");
};

const tokenAddress = item => String(item?.baseToken?.address || item?.tokenAddress || item?.address || item?.token?.address || item?.contractAddress || "").trim();

const mergeBaseTokens = async (clankerTokens) => {
  const baseClanker = clankerTokens.filter(item => isBase(item) || (!item?.chainId && !item?.chain && !item?.network));
  const [boosts, profiles] = await Promise.all([
    getJson("https://api.dexscreener.com/token-boosts/latest/v1").catch(() => []),
    getJson("https://api.dexscreener.com/token-profiles/latest/v1").catch(() => [])
  ]);
  const discovery = [...(Array.isArray(boosts) ? boosts : []), ...(Array.isArray(profiles) ? profiles : [])]
    .filter(item => isBase(item) && item?.tokenAddress);
  const unique = new Map();
  for (const item of discovery) {
    const address = item.tokenAddress.toLowerCase();
    if (!unique.has(address)) unique.set(address, item);
  }
  const discovered = [...unique.values()];
  const basePairs = [];
  for (let i = 0; i < discovered.length; i += 30) {
    const batch = discovered.slice(i, i + 30);
    const addresses = batch.map(item => item.tokenAddress).join(",");
    const pairs = await getJson("https://api.dexscreener.com/tokens/v1/base/" + encodeURIComponent(addresses)).catch(() => []);
    if (!Array.isArray(pairs)) continue;
    for (const pair of pairs) {
      if (String(pair?.chainId).toLowerCase() !== "base") continue;
      const address = String(pair?.baseToken?.address || "").toLowerCase();
      const meta = batch.find(item => item.tokenAddress.toLowerCase() === address);
      if (meta) basePairs.push({ ...pair, description: meta.description || "", info: pair.info || { imageUrl: meta.icon }, profileUrl: meta.url, type: "Trending" });
    }
  }
  const best = new Map();
  for (const pair of basePairs) {
    const address = String(pair?.baseToken?.address || "").toLowerCase();
    if (!address) continue;
    if (!best.has(address) || Number(pair.liquidity?.usd || 0) > Number(best.get(address).liquidity?.usd || 0)) best.set(address, pair);
  }
  const dexBase = [...best.values()].sort((a,b) => Number(b.volume?.h24 || 0) - Number(a.volume?.h24 || 0));
  const clankerAddresses = new Set(baseClanker.map(tokenAddress).filter(Boolean).map(address => address.toLowerCase()));
  const additionalBase = dexBase.filter(item => !clankerAddresses.has(String(item.baseToken?.address || "").toLowerCase()));
  const prioritizedBase = [...baseClanker, ...additionalBase].slice(0, 12);
  const prioritizedAddresses = new Set(prioritizedBase.map(tokenAddress).filter(Boolean).map(address => address.toLowerCase()));
  const remaining = clankerTokens.filter(item => !prioritizedAddresses.has(tokenAddress(item).toLowerCase()));
  return [...prioritizedBase, ...remaining].slice(0, 20);
};

export async function onRequest({ request }) {
  const url = new URL(request.url);
  if (url.searchParams.get("chain")?.toUpperCase() === "BASE") {
    try {
      const tokens = await fetchBaseDexTokens();
      if (!tokens.length) return json({ error: "No Base tokens were returned by Clanker or DexScreener", detail: "The live providers returned no Base token pairs. Try again shortly." }, 502, url.origin);
      return json({ source: "Clanker + DexScreener Base", tokens }, 200, url.origin, "public, max-age=15, s-maxage=20");
    } catch (error) {
      return json({ error: "Unable to load Base token feed", detail: String(error?.message || error) }, 502, url.origin);
    }
  }
  const origin = new URL(request.url).origin;
  let clankerError = "";
  try {
    const clanker = await getJson("https://www.clanker.world/api/tokens/trending");
    const tokens = extractTokens(clanker);
    if (Array.isArray(tokens) && tokens.length) {
      const combined = await mergeBaseTokens(tokens).catch(() => tokens);
      return json({ source: "Clanker + DexScreener Base", tokens: combined }, 200, origin, "public, max-age=15, s-maxage=20");
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
          const metadata = batch.find(item => item.tokenAddress?.toLowerCase() === address);
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
