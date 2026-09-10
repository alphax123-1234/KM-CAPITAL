/* ==========================================================================
   AEY Terminal — Mansa API CORS Proxy (Cloudflare Worker)
   
   Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker
   Env var: MANSA_API_KEY (encrypted) in Settings → Variables & Secrets
   
   Routes:
     /v1/stocks              → Mansa USE equities
     /v1/stocks/:ticker/history → Mansa stock OHLCV
     /v1/forex               → Mansa African forex rates
     /health                 → Status check
   ========================================================================== */

const MANSA_ORIGIN = "https://mansaapi.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "X-Cache-Status, X-Upstream"
};

function resp(body, status) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS }
  });
}

async function proxyFetch(mansaPath, env) {
  const apiKey = env.MANSA_API_KEY || "";
  const headers = apiKey ? { "Authorization": "Bearer " + apiKey, "X-API-Key": apiKey } : {};

  let res = await fetch(MANSA_ORIGIN + mansaPath, { headers, redirect: "manual" });

  if (res.status === 308 || res.status === 301 || res.status === 302) {
    const loc = res.headers.get("Location");
    if (loc) {
      const next = loc.startsWith("http") ? loc : MANSA_ORIGIN + loc;
      res = await fetch(next, { headers, redirect: "manual" });
    }
  }

  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": "application/json", ...CORS, "X-Upstream": MANSA_ORIGIN }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/" || path === "/health") {
      return resp({ status: "ok", worker: "km-capital", base: MANSA_ORIGIN, time: new Date().toISOString() }, 200);
    }

    if (path === "/v1/stocks") {
      return proxyFetch("/api/v1/markets/exchanges/USE/stocks", env);
    }

    if (path === "/v1/forex") {
      return proxyFetch("/api/v1/markets/forex", env);
    }

    const historyMatch = path.match(/^\/v1\/stocks\/([^/]+)\/history$/);
    if (historyMatch) {
      const ticker = historyMatch[1];
      const range = url.searchParams.get("range") || "1Y";
      return proxyFetch(`/api/v1/markets/exchanges/USE/stocks/${ticker}/history?range=${range}`, env);
    }

    return resp({ error: "Not found", path, routes: ["/v1/stocks", "/v1/forex", "/v1/stocks/:ticker/history?range=1Y", "/health"] }, 404);
  }
};
