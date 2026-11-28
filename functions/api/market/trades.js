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

export async function onRequest({ request }) {
  const url = new URL(request.url);
  const chain = CHAINS[String(url.searchParams.get("chain") || "").toUpperCase()];
  const address = String(url.searchParams.get("address") || "").trim();
  if (!chain) return json({ error: "Unsupported chain for transaction data" }, 400, "no-store");
  if (!address || address.length > 64 || !/^[a-zA-Z0-9]+$/.test(address)) {
    return json({ error: "Invalid token address" }, 400, "no-store");
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
    if (!pair) return json({ error: "No indexed liquidity pool found for this token" }, 404, "no-store");

    const tradeUrl = "https://api.geckoterminal.com/api/v2/networks/" +
      encodeURIComponent(chain.gecko) + "/pools/" + encodeURIComponent(pair.pairAddress) + "/trades";
    const tradeResponse = await fetch(tradeUrl, {
      headers: { Accept: "application/json;version=20230203" }
    });
    if (!tradeResponse.ok) {
      if (tradeResponse.status === 404) return json({ error: "This pool is not indexed by GeckoTerminal yet" }, 404, "no-store");
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

    return json({
      source: "GeckoTerminal",
      poolAddress: pair.pairAddress,
      pairUrl: pair.url || null,
      transactions
    });
  } catch (error) {
    return json({ error: "Unable to load recent transactions", detail: String(error?.message || error) }, 502, "no-store");
  }
}
