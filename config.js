/* ==========================================================================
   EXTERNAL CONFIGURATION
   API keys and sensitive configuration — keep this file out of version control
   
   MANSA_PROXY_URL: Your Cloudflare Worker URL (deploy worker.js for free)
   Setup: https://workers.cloudflare.com → Create Worker → Paste worker.js → Deploy
   The API key is stored as an encrypted env var in Cloudflare (not exposed to browser).
   ========================================================================== */
const CONFIG = {
  MANSA_API_KEY: "",                          // Not needed when using proxy — key lives in Cloudflare env
  MANSA_PROXY_URL: "",                        // Paste your worker URL here, e.g. "https://mansa-proxy.your-name.workers.dev"
};
