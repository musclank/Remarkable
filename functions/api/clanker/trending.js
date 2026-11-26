export async function onRequest({ request }) {
  const upstream = "https://www.clanker.world/api/tokens/trending";
  try {
    const response = await fetch(upstream, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "Remarkable-Token-Explorer/1.0"
      },
      cf: { cacheTtl: 20, cacheEverything: true }
    });
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", new URL(request.url).origin);
    headers.set("Cache-Control", "public, max-age=15, s-maxage=20");
    headers.set("Content-Type", "application/json; charset=utf-8");
    if (!response.ok) {
      return new Response(JSON.stringify({
        error: "Clanker API returned " + response.status
      }), { status: 502, headers });
    }
    return new Response(response.body, { status: 200, headers });
  } catch (error) {
    return new Response(JSON.stringify({
      error: "Unable to reach Clanker API",
      detail: String(error?.message || error)
    }), {
      status: 502,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": new URL(request.url).origin
      }
    });
  }
}
