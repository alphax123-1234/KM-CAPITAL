/* ==========================================================================
   Cloudflare Worker — Mansa API CORS Proxy
   Deploy free at https://workers.cloudflare.com (100k req/day included)
   
   Setup:
   1. Create free Cloudflare account → Workers & Pages → Create Worker
   2. Paste this entire file into the worker editor
   3. Set MANSA_API_KEY as an encrypted environment variable in Settings
   4. Deploy — copy the worker URL into config.js as MANSA_PROXY_URL
   ========================================================================== */

const MANSA_ORIGIN = "https://mansamarkets.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const targetPath = url.searchParams.get("path");
    if (!targetPath) {
      return new Response(JSON.stringify({ error: "Missing ?path= parameter" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }

    const targetUrl = MANSA_ORIGIN + targetPath;
    const headers = {};
    if (env.MANSA_API_KEY) {
      headers["Authorization"] = "Bearer " + env.MANSA_API_KEY;
    }

    try {
      const res = await fetch(targetUrl, { headers, redirect: "follow" });
      const body = await res.text();
      return new Response(body, {
        status: res.status,
        headers: {
          "Content-Type": res.headers.get("Content-Type") || "application/json",
          ...CORS_HEADERS
        }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }
  }
};
