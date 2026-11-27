const json = (data, status = 200, cache = "public, max-age=20, s-maxage=30") => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache }
});

const CHAINS = {
  BASE: "base", "8453": "base",
  BSC: "bsc", BNB: "bsc", "56": "bsc",
  SOLANA: "solana",
  ETH: "ethereum", ETHEREUM: "ethereum", "1": "ethereum"
};

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const chain = CHAINS[String(url.searchParams.get("chain") || "").toUpperCase()];
  const address = String(url.searchParams.get("address") || "").trim();
  if (!chain) return json({ error: "Unsupported chain for DexScreener price data" }, 400, "no-store");
  if (!address || address.length > 64 || !/^[a-zA-Z0-9]+$/.test(address)) return json({ error: "Invalid token address" }, 400, "no-store");

  try {
    const response = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(address), {
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error("DexScreener HTTP " + response.status);
    const payload = await response.json();
    const pairs = Array.isArray(payload?.pairs) ? payload.pairs : [];
    const matching = pairs.filter(pair => String(pair.chainId || "").toLowerCase() === chain && pair.priceUsd);
    const pair = matching.sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
    if (!pair) return json({ error: "DexScreener has no indexed pair for this token yet" }, 404, "no-store");

    return json({
      source: "DexScreener",
      priceUsd: pair.priceUsd || null,
      change24h: pair.priceChange?.h24 ?? null,
      liquidityUsd: pair.liquidity?.usd ?? null,
      volume24hUsd: pair.volume?.h24 ?? null,
      transactions: {
        h1: { buys: pair.txns?.h1?.buys ?? null, sells: pair.txns?.h1?.sells ?? null },
        h24: { buys: pair.txns?.h24?.buys ?? null, sells: pair.txns?.h24?.sells ?? null }
      },
      pairAddress: pair.pairAddress || null,
      pairUrl: pair.url || null,
      candles: []
    });
  } catch (error) {
    return json({ error: "Unable to load live DexScreener price", detail: String(error?.message || error) }, 502, "no-store");
  }
}
