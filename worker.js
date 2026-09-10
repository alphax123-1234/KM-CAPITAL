/* ==========================================================================
   AEY Terminal — Mansa API CORS Proxy (Cloudflare Worker)
   
   Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker
   Env var: MANSA_API_KEY (encrypted) in Settings → Variables & Secrets
   
   Routes:
     /v1/stocks              → Mansa USE equities
     /v1/stocks/:ticker/history → Mansa stock OHLCV
     /v1/forex               → er-api.com USD/UGX + USD/KES
     /health                 → Status check
   ========================================================================== */

const MANSA_ORIGIN = "https://mansamarkets.com";
const FOREX_ORIGIN = "https://open.er-api.com/v6/latest/USD";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "X-Cache-Status"
};

function resp(body, status, extra) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...extra }
  });
}

async function proxyFetch(url, headers) {
  const res = await fetch(url, { headers, redirect: "follow" });
  if (res.status === 308 || res.status === 301 || res.status === 302) {
    const loc = res.headers.get("Location");
    if (loc) {
      const next = loc.startsWith("http") ? loc : MANSA_ORIGIN + loc;
      return fetch(next, { headers, redirect: "follow" });
    }
  }
  return res;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    /* ---- Health ---- */
    if (path === "/" || path === "/health") {
      return resp({ status: "ok", worker: "km-capital", time: new Date().toISOString() }, 200);
    }

    /* ---- Forex: /v1/forex ---- */
    if (path === "/v1/forex") {
      try {
        const res = await fetch(FOREX_ORIGIN);
        const data = await res.json();
        return resp(data, 200);
      } catch (e) {
        return resp({ error: "Forex fetch failed", detail: e.message }, 502);
      }
    }

    /* ---- Stocks: /v1/stocks ---- */
    if (path === "/v1/stocks") {
      const headers = {};
      if (env.MANSA_API_KEY) headers["Authorization"] = "Bearer " + env.MANSA_API_KEY;
      try {
        const res = await proxyFetch(MANSA_ORIGIN + "/api/v1/markets/exchanges/USE/stocks", headers);
        const body = await res.text();
        return new Response(body, {
          status: res.status,
          headers: { "Content-Type": "application/json", ...CORS, "X-Upstream": "mansa-stocks" }
        });
      } catch (e) {
        return resp({ error: "Stocks fetch failed", detail: e.message }, 502);
      }
    }

    /* ---- Stock History: /v1/stocks/:ticker/history ---- */
    const historyMatch = path.match(/^\/v1\/stocks\/([^/]+)\/history$/);
    if (historyMatch) {
      const ticker = historyMatch[1];
      const range = url.searchParams.get("range") || "1Y";
      const headers = {};
      if (env.MANSA_API_KEY) headers["Authorization"] = "Bearer " + env.MANSA_API_KEY;
      try {
        const res = await proxyFetch(
          MANSA_ORIGIN + `/api/v1/markets/exchanges/USE/stocks/${ticker}/history?range=${range}`,
          headers
        );
        const body = await res.text();
        return new Response(body, {
          status: res.status,
          headers: { "Content-Type": "application/json", ...CORS, "X-Upstream": "mansa-history" }
        });
      } catch (e) {
        return resp({ error: "History fetch failed", detail: e.message }, 502);
      }
    }

    /* ---- 404 ---- */
    return resp({ error: "Not found", path: path, routes: ["/v1/stocks", "/v1/forex", "/v1/stocks/:ticker/history?range=1Y", "/health"] }, 404);
  }
};
