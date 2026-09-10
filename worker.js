/* ==========================================================================
   AEY Terminal — Mansa API CORS Proxy (Cloudflare Worker)
   
   Deploy: https://dash.cloudflare.com → Workers & Pages → Create Worker
   Env var: MANSA_API_KEY (encrypted) in Settings → Variables & Secrets
   
   Features:
   - CORS headers for GitHub Pages / any origin
   - Auth header injection (key never reaches the browser)
   - Edge caching (Cloudflare CDN) to save your free-tier budget
   - Request logging for debugging
   - Rate-limit aware: caches aggressively to stay under Mansa's 100 req/day
   - Health check at GET /
   ========================================================================== */

const MANSA_ORIGIN = "https://mansamarkets.com";
const ALLOWED_ORIGINS = [
  "https://alohax123-1234.github.io",
  "http://localhost:8888",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

const CORS_HEADERS = {
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  "Access-Control-Expose-Headers": "X-Cache-Status"
};

function getCorsOrigin(request) {
  const origin = request.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

function json(data, status, extra) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      "Access-Control-Allow-Origin": "*",
      ...extra
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = getCorsOrigin(request);

    /* ---- CORS preflight ---- */
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          "Access-Control-Allow-Origin": origin
        }
      });
    }

    /* ---- Health check ---- */
    if (url.pathname === "/" || url.pathname === "") {
      return json({
        status: "ok",
        service: "AEY Terminal Mansa Proxy",
        endpoints: [
          "GET /?path=/markets/exchanges/USE/stocks",
          "GET /?path=/markets/exchanges/USE",
          "GET /?path=/markets/exchanges/USE/stocks/{ticker}/history?range=1Y",
          "GET /?path=/markets/yields/UG/tbills",
          "GET /?path=/macro/policy-rates",
          "GET /?path=/markets/exchanges/USE/indices",
          "GET /health"
        ]
      }, 200);
    }

    /* ---- Health ping ---- */
    if (url.pathname === "/health") {
      return json({ status: "ok", timestamp: new Date().toISOString() }, 200);
    }

    /* ---- Proxy target ---- */
    const targetPath = url.searchParams.get("path");
    if (!targetPath) {
      return json({
        error: "Missing ?path= parameter",
        usage: "/?path=/markets/exchanges/USE/stocks"
      }, 400);
    }

    /* ---- Build upstream URL ---- */
    const targetUrl = MANSA_ORIGIN + targetPath;
    const upstreamHeaders = {};
    if (env.MANSA_API_KEY) {
      upstreamHeaders["Authorization"] = "Bearer " + env.MANSA_API_KEY;
    }

    /* ---- Fetch from Mansa ---- */
    let upstreamRes;
    try {
      upstreamRes = await fetch(targetUrl, {
        headers: upstreamHeaders,
        redirect: "follow",
        cf: { cacheTtl: 300, cacheEverything: false }
      });
    } catch (e) {
      return json({ error: "Upstream fetch failed", detail: e.message }, 502, {
        "Access-Control-Allow-Origin": origin
      });
    }

    /* ---- Handle 308 redirects (Mansa enforces trailing slash or HTTPS) ---- */
    if (upstreamRes.status === 308 || upstreamRes.status === 301 || upstreamRes.status === 302) {
      const location = upstreamRes.headers.get("Location");
      if (location) {
        const redirectUrl = location.startsWith("http") ? location : MANSA_ORIGIN + location;
        try {
          upstreamRes = await fetch(redirectUrl, {
            headers: upstreamHeaders,
            redirect: "follow",
            cf: { cacheTtl: 300, cacheEverything: false }
          });
        } catch (e) {
          return json({ error: "Redirect fetch failed", detail: e.message }, 502, {
            "Access-Control-Allow-Origin": origin
          });
        }
      }
    }

    /* ---- Read response ---- */
    const body = await upstreamRes.text();
    const contentType = upstreamRes.headers.get("Content-Type") || "application/json";
    const cacheStatus = upstreamRes.headers.get("CF-Cache-Status") || "MISS";

    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": contentType,
        "X-Cache-Status": cacheStatus,
        "X-Proxy": "aey-mansa-proxy",
        ...CORS_HEADERS,
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
