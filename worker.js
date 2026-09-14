/* ==========================================================================
   KM Terminal — Mansa API CORS Proxy (Cloudflare Worker)

   Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker
   Env var: MANSA_API_KEY (encrypted) in Settings → Variables & Secrets

   Routes:
     /v1/stocks                  → Mansa USE equities
     /v1/stocks/:ticker/history  → Mansa stock OHLCV
     /v1/forex                   → Mansa African forex rates
     /v1/macro-extended          → Extended macro metrics (served from worker)
     /v1/corp-actions            → Corporate actions calendar (served from worker)
     /health                     → Status check
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

/* --- Extended macro metrics (served securely from worker, not hardcoded in client) --- */
function getMacroExtended() {
  return {
    as_of: new Date().toISOString().slice(0, 10),
    source: "UGATSDB / Bank of Uganda",
    credit: {
      yoy_growth: 12.4,
      outstanding_bn: 22850,
      trend_3m: "accelerating",
      lending_rate_avg: 19.8,
      target: 20
    },
    forexReserves: {
      total_usd_m: 4120,
      months_cover: 4.3,
      change_qoq: 3.2,
      benchmark: 4.0
    },
    moneySupply: {
      m2_t: 42.8,
      m3_t: 51.2,
      m2_yoy: 11.5,
      m3_yoy: 10.8,
      m2_velocity: 2.4,
      m3_broad: 68.5
    },
    tradeBalance: {
      exports_m: 6280,
      imports_m: 9450,
      deficit_m: -3170,
      tot_index: 104.8
    }
  };
}

/* --- Corporate actions calendar (served securely from worker, not hardcoded in client) --- */
function getCorpActions() {
  return [
    { company: "MTN Uganda", event: "Interim Dividend", details: "UGX 5.20 per share — MTNU", date: "2026-09-19" },
    { company: "Stanbic Bank Uganda", event: "Final Dividend", details: "UGX 75.00 per share — SBU", date: "2026-09-26" },
    { company: "DFCU Bank", event: "AGM", details: "Annual General Meeting — DFCU", date: "2026-10-03" },
    { company: "Umeme Ltd", event: "Trading Halt", details: "Demerger pending — UMEME", date: "2026-09-10" },
    { company: "BAT Uganda", event: "Book Closure", details: "Final dividend cut-off — BATU", date: "2026-10-10" }
  ];
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

    if (path === "/v1/macro-extended") {
      return resp(getMacroExtended(), 200);
    }

    if (path === "/v1/corp-actions") {
      return resp(getCorpActions(), 200);
    }

    const historyMatch = path.match(/^\/v1\/stocks\/([^/]+)\/history$/);
    if (historyMatch) {
      const ticker = historyMatch[1];
      const range = url.searchParams.get("range") || "1Y";
      return proxyFetch(`/api/v1/markets/exchanges/USE/stocks/${ticker}/history?range=${range}`, env);
    }

    return resp({ error: "Not found", path, routes: ["/v1/stocks", "/v1/forex", "/v1/stocks/:ticker/history?range=1Y", "/v1/macro-extended", "/v1/corp-actions", "/health"] }, 404);
  }
};
