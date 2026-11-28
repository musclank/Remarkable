const json = (data, status = 200, cache = "public, max-age=30, s-maxage=60") => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache }
});

const CHAINS = {
  BASE: { dex: "base", gecko: "base", explorer: "https://basescan.org/tx/" },
  "8453": { dex: "base", gecko: "base", explorer: "https://basescan.org/tx/" },
  BSC: { dex: "bsc", gecko: "bsc", explorer: "https://bscscan.com/tx/" },
  BNB: { dex: "bsc", gecko: "bsc", explorer: "https://bscscan.com/tx/" },
  "56": { dex: "bsc", gecko: "bsc", explorer: "https://bscscan.com/tx/" },
  SOLANA: { dex: "solana", gecko: "solana", explorer: "https://solscan.io/tx/" },
  ETH: { dex: "ethereum", gecko: "eth", explorer: "https://etherscan.io/tx/" },
  ETHEREUM: { dex: "ethereum", gecko: "eth", explorer: "https://etherscan.io/tx/" },
  "1": { dex: "ethereum", gecko: "eth", explorer: "https://etherscan.io/tx/" }
};

const cacheKey = request => {
  const url = new URL(request.url);
  url.pathname = "/_edge-cache/market-trades";
  url.searchParams.sort();
  return new Request(url.toString(), { method: "GET" });
};

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const chain = CHAINS[String(url.searchParams.get("chain") || "").toUpperCase()];
  const address = String(url.searchParams.get("address") || "").trim();
  if (!chain) return json({ error: "Unsupported chain for transaction data" }, 400, "no-store");
  if (!address || address.length > 64 || !/^[a-zA-Z0-9]+$/.test(address)) {
    return json({ error: "Invalid token address" }, 400, "no-store");
  }

  const key = cacheKey(request);
  const edgeCache = typeof caches !== "undefined" ? caches.default : null;
  if (edgeCache) {
    const cached = await edgeCache.match(key);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Market-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }
  }

  try {
    const dexResponse = await fetch("https://api.dexscreener.com/latest/dex/tokens/" + encodeURIComponent(address), {
      headers: { Accept: "application/json" }
    });
    if (!dexResponse.ok) throw new Error("DexScreener HTTP " + dexResponse.status);
    const dexPayload = await dexResponse.json();
    const pairs = Array.isArray(dexPayload?.pairs) ? dexPayload.pairs : [];
    const pair = pairs
      .filter(item => String(item.chainId || "").toLowerCase() === chain.dex && item.pairAddress)
      .sort((a, b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
    if (!pair) return json({ transactions: [], warning: "No indexed liquidity pool found for this token yet." }, 200, "public, max-age=60, s-maxage=120");

    const tradeUrl = "https://api.geckoterminal.com/api/v2/networks/" +
      encodeURIComponent(chain.gecko) + "/pools/" + encodeURIComponent(pair.pairAddress) + "/trades";
    const tradeResponse = await fetch(tradeUrl, {
      headers: { Accept: "application/json;version=20230203" }
    });

    if (tradeResponse.status === 429) {
      const retryAfter = Math.max(30, Math.min(300, Number(tradeResponse.headers.get("Retry-After")) || 120));
      return json({
        source: "GeckoTerminal",
        poolAddress: pair.pairAddress,
        pairUrl: pair.url || null,
        transactions: [],
        warning: "Transaction feed is temporarily rate-limited. Please try again in about " + retryAfter + " seconds."
      }, 200, "public, max-age=45, s-maxage=90");
    }
    if (!tradeResponse.ok) {
      if (tradeResponse.status === 404) return json({ transactions: [], warning: "This pool is not indexed by GeckoTerminal yet." }, 200, "public, max-age=120, s-maxage=180");
      throw new Error("GeckoTerminal HTTP " + tradeResponse.status);
    }

    const payload = await tradeResponse.json();
    const transactions = (Array.isArray(payload?.data) ? payload.data : []).slice(0, 20).map(item => {
      const trade = item?.attributes || {};
      const hash = String(trade.tx_hash || item?.id || "");
      return {
        hash,
        type: String(trade.kind || "").toLowerCase(),
        volumeUsd: Number(trade.volume_in_usd || 0),
        timestamp: trade.block_timestamp || null,
        wallet: trade.tx_from_address || null,
        url: hash ? chain.explorer + encodeURIComponent(hash) : null
      };
    }).filter(item => item.hash && item.type && item.timestamp);

    const response = json({
      source: "GeckoTerminal",
      poolAddress: pair.pairAddress,
      pairUrl: pair.url || null,
      transactions
    }, 200, "public, max-age=90, s-maxage=180");
    if (edgeCache) {
      const cachedResponse = new Response(response.clone().body, {
        status: response.status,
        headers: response.headers
      });
      cachedResponse.headers.set("Cache-Control", "public, max-age=90, s-maxage=180");
      await edgeCache.put(key, cachedResponse);
    }
    return response;
  } catch (error) {
    return json({
      transactions: [],
      warning: "Recent transactions are temporarily unavailable. Price and portfolio data are unaffected.",
      detail: String(error?.message || error)
    }, 200, "public, max-age=30, s-maxage=60");
  }
}
