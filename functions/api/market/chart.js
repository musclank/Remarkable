const json = (data, status = 200, cache = "public, max-age=45, s-maxage=60") => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache }
});

const NETWORKS = {
  BASE: "base", "8453": "base",
  SOLANA: "solana",
  ETH: "eth", ETHEREUM: "eth", "1": "eth"
};

const getJson = async url => {
  const cache = caches.default;
  const key = new Request(url, { method: "GET" });
  const cached = await cache.match(key);
  const storedAt = Number(cached?.headers.get("x-remarkable-cached-at") || 0);
  const ageMs = storedAt ? Date.now() - storedAt : Infinity;

  // Serve very recent edge data without hitting GeckoTerminal again.
  if (cached && ageMs < 90_000) return cached.clone().json();

  const response = await fetch(url, {
    headers: { Accept: "application/json;version=20230302", "User-Agent": "Remarkable-Token-Chart/1.0" }
  });

  if (response.ok) {
    const payload = await response.clone().json();
    const cacheResponse = new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=900",
        "x-remarkable-cached-at": String(Date.now())
      }
    });
    await cache.put(key, cacheResponse);
    return payload;
  }

  // If the provider rate-limits this request, serve the last known successful
  // response for up to 15 minutes rather than breaking the chart.
  if (response.status === 429 && cached && ageMs < 15 * 60_000) {
    return cached.clone().json();
  }
  if (response.status === 429) throw new Error("GeckoTerminal rate limit (429). Please wait a minute and retry.");
  throw new Error("GeckoTerminal HTTP " + response.status);
};

const relationAddress = value => String(value || "").replace(/^[^_]+_/, "").toLowerCase();

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const chain = NETWORKS[String(url.searchParams.get("chain") || "").toUpperCase()];
  const address = String(url.searchParams.get("address") || "").trim();
  const range = url.searchParams.get("range") || "1D";
  if (!chain) return json({ error: "Unsupported chain for chart data" }, 400, "no-store");
  if (!address || address.length > 64 || !/^[a-zA-Z0-9]+$/.test(address)) return json({ error: "Invalid token address" }, 400, "no-store");

  try {
    const poolPayload = await getJson("https://api.geckoterminal.com/api/v2/networks/" + chain + "/tokens/" + encodeURIComponent(address) + "/pools?include=base_token,quote_token");
    const pools = Array.isArray(poolPayload?.data) ? poolPayload.data : [];
    const pool = pools.sort((a, b) => Number(b.attributes?.reserve_in_usd || 0) - Number(a.attributes?.reserve_in_usd || 0))[0];
    if (!pool?.attributes || !pool.id) return json({ error: "No indexed liquidity pool found for this token" }, 404, "no-store");

    const attributes = pool.attributes;
    const baseAddress = String(attributes.base_token_address || relationAddress(pool.relationships?.base_token?.data?.id) || "").toLowerCase();
    const targetIsBase = baseAddress === address.toLowerCase();
    const tokenSide = targetIsBase ? "base" : "quote";
    const poolAddress = pool.id.slice(pool.id.indexOf("_") + 1);

    let timeframe = "minute", aggregate = "15", limit = "96";
    if (range === "1W") { timeframe = "hour"; aggregate = "1"; limit = "168"; }
    if (range === "1M") { timeframe = "hour"; aggregate = "4"; limit = "180"; }

    const candlesUrl = "https://api.geckoterminal.com/api/v2/networks/" + chain + "/pools/" + encodeURIComponent(poolAddress) + "/ohlcv/" + timeframe + "?aggregate=" + aggregate + "&limit=" + limit + "&currency=usd&token=" + tokenSide;
    const candlesPayload = await getJson(candlesUrl);
    const candles = candlesPayload?.data?.attributes?.ohlcv_list;
    if (!Array.isArray(candles) || !candles.length) return json({ error: "No price history is available for this pool yet" }, 404, "no-store");

    return json({
      source: "GeckoTerminal",
      pool: poolAddress,
      priceUsd: (targetIsBase ? attributes.base_token_price_usd : attributes.quote_token_price_usd) || null,
      liquidityUsd: attributes.reserve_in_usd || null,
      volume24hUsd: attributes.volume_usd?.h24 || null,
      candles: candles.map(c => ({ time: c[0], open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5] })).reverse()
    });
  } catch (error) {
    const message = String(error?.message || error);
    const limited = message.includes("429") || message.toLowerCase().includes("rate limit");
    return json(
      { error: limited ? "Price provider is temporarily rate-limited" : "Unable to load onchain price history", detail: message },
      limited ? 429 : 502,
      limited ? "public, max-age=30, s-maxage=60" : "no-store"
    );
  }
}
