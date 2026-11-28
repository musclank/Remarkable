const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});
const addressPattern = /^0x[a-fA-F0-9]{40}$/;
const hashPattern = /^0x[a-fA-F0-9]{64}$/;
const clean = (value, max) => String(value || "").trim().slice(0, max);

async function rpc(method, params) {
  const response = await fetch("https://mainnet.base.org", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params })
  });
  if (!response.ok) throw new Error("Base RPC unavailable");
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || "Base RPC error");
  return body.result;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": url.origin, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
  if (!env?.DB) return json({ error: "Token Registry database is not configured. Add the Cloudflare D1 binding named DB." }, 503);

  if (request.method === "GET") {
    try {
      const { results = [] } = await env.DB.prepare(
        "SELECT token_address AS address, name, symbol, image_uri AS imageUri, description, website, social_url AS social, tx_hash AS txHash, created_at AS createdAt FROM token_registry WHERE chain_id = 8453 ORDER BY created_at DESC LIMIT 100"
      ).all();
      return json({ tokens: results });
    } catch (error) {
      return json({ error: "Could not read Token Registry", detail: String(error?.message || error) }, 500);
    }
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (request.headers.get("Origin") && request.headers.get("Origin") !== url.origin) return json({ error: "Cross-origin requests are not allowed" }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const address = clean(body.address, 42);
  const txHash = clean(body.txHash, 66);
  const name = clean(body.name, 50);
  const symbol = clean(body.symbol, 25).toUpperCase();
  const imageUri = clean(body.imageUri, 500);
  const description = clean(body.description, 500);
  const website = clean(body.website, 300);
  const social = clean(body.social, 300);
  if (Number(body.chainId) !== 8453 || !addressPattern.test(address) || !hashPattern.test(txHash) || name.length < 2 || !/^[A-Z0-9]{2,25}$/.test(symbol) || (imageUri && !/^(https?:\/\/|ipfs:\/\/)/i.test(imageUri))) {
    return json({ error: "Invalid Base token metadata" }, 400);
  }

  try {
    const receipt = await rpc("eth_getTransactionReceipt", [txHash]);
    if (!receipt || receipt.status !== "0x1") return json({ error: "Transaction is not confirmed successfully on Base" }, 400);
    const addressLower = address.toLowerCase();
    const addressHex = addressLower.slice(2);\n    const transactionReferencesToken = (receipt.logs || []).some(log => {\n      const evidence = [log.address, ...(log.topics || []), log.data].filter(Boolean).join(" ").toLowerCase();\n      return evidence.includes(addressLower) || evidence.includes(addressHex);\n    });
    const code = await rpc("eth_getCode", [address, "latest"]);
    if (!transactionReferencesToken || !code || code === "0x") return json({ error: "Token address could not be verified against the confirmed transaction" }, 400);

    await env.DB.prepare(
      "INSERT INTO token_registry (chain_id, token_address, name, symbol, image_uri, description, website, social_url, tx_hash, created_at) VALUES (8453, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')) ON CONFLICT(chain_id, token_address) DO UPDATE SET name=excluded.name, symbol=excluded.symbol, image_uri=excluded.image_uri, description=excluded.description, website=excluded.website, social_url=excluded.social_url, tx_hash=excluded.tx_hash"
    ).bind(addressLower, name, symbol, imageUri, description, website, social, txHash).run();
    return json({ success: true, address: addressLower, status: "registered" }, 201);
  } catch (error) {
    return json({ error: "Token deployed, but registry verification or storage failed", detail: String(error?.message || error) }, 503);
  }
}
