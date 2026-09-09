# AEY Terminal — Uganda Market Dashboard

A static, TradingView-inspired dashboard for Ugandan markets: USE equities, macro
indicators, fixed income, agriculture spot prices, and coffee auction prices. Built
with vanilla HTML, Tailwind CDN, and [Lightweight Charts](https://github.com/tradingview/lightweight-charts).

## Live Data Sources

| Source | Data | How | Cost |
|---|---|---|---|
| **Mansa API** | USE equities, ASI index, CBR, inflation | REST API (Bearer token) | Free: 100 req/day |
| **Mansa Demo** | Market open/closed status (USE) | REST API (no key) | Free, unlimited |
| **Frankfurter API** | Official BoU USD/UGX exchange rate | REST API (no key) | Free, unlimited |
| **UCDA Website** | Daily coffee auction prices (13 grades) | HTML scraper | Free |

## Setup

### 1. Get a Mansa API Key (free)
1. Go to https://mansaapi.com and create an account
2. Copy your API key from the dashboard
3. Paste it into `index.html` in the `MANSA_API_KEY` constant at the top of the `<script>` tag

### 2. Deploy on GitHub Pages
1. Push this folder (`index.html` + `data/` + `scripts/`) to a repo
2. Repo Settings → Pages → Deploy from branch → `main` / root
3. Done — no build step needed

## What's live vs. manual

| Data | Status | Why |
|---|---|---|
| USD/UGX | **Live** | Frankfurter API sources from Bank of Uganda. No key needed. |
| USE Equities (MTNU, SBU, UMEME, etc.) | **Live** (with Mansa key) | Mansa API tracks USE with 30-min delay. Falls back to local JSON without key. |
| USE All Share Index | **Live** (with Mansa key) | Mansa API exchange snapshot endpoint. |
| USE Market Status | **Live** | Mansa demo endpoint — shows open/closed, next open time. No key needed. |
| CBR (Central Bank Rate) | **Live** (with Mansa key) | Mansa macro/policy-rates endpoint. Falls back to local JSON. |
| Inflation (CPI) | **Live** (with Mansa key) | Mansa macro/policy-rates endpoint. Falls back to local JSON. |
| Coffee Auction Prices | **Live** | UCDA website scraper parses daily auction prices for 13 grades. |
| 10-Year Bond Yield | **Manual only** | Bank of Uganda publishes in PDFs. Mansa Pro required for live. |
| Bond yields (T-bills, T-bonds) | **Manual only** | Edit `data/fixed_income_yields.json` from BoU auction results. Mansa Pro required for live. |
| Agriculture spot prices | **Manual only, illustrative** | Edit `data/agriculture_spot.json`. |
| Candlestick chart history | **Synthetic** (free) / **Real** (Mansa Pro) | Free tier: generated around last known price. Pro: real OHLCV from Mansa. |

## Rate Budget

The dashboard is designed to stay well within Mansa's 100 requests/day free tier:
- Boot: ~7 requests (stocks, exchange, movers, macro, indices)
- Each stock click: 1 request (cached 24h per ticker)
- Market status: unlimited (free demo endpoint, refreshes every 5 min)
- Coffee + forex: unlimited (separate free APIs)
- Typical usage: ~15-25 requests/day

## File Structure

```
index.html                    # entire app — layout, styles, chart, logic
data/macro_indicators.json    # CBR, CPI, bond yield (manual)
data/stocks_daily.json        # USE watchlist fallback (manual)
data/fixed_income_yields.json # T-bill/bond yields (manual)
data/agriculture_spot.json    # commodity spot prices (manual, illustrative)
data/macro_timeseries.json    # CPI & GDP history (auto-updated via GitHub Action)
scripts/fetch_macro_timeseries.R  # R script for ugatsdb data
```

## Adding Real Data

- **USE prices**: Provided by Mansa API — just add your key. No scraping needed.
- **Coffee prices**: Scraped live from UCDA. Works out of the box.
- **CBR + Inflation**: Provided by Mansa API macro/policy-rates. Just add your key.
- **Market status**: Free demo endpoint — works without a key.
- **Bond yields / T-bills**: Manual entry from BoU releases. Mansa Pro ($99/month) required for live data.
- **Chart history**: Mansa Pro plan provides real OHLCV. On free tier, synthetic candles are used.
