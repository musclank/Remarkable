# Remarkable — Onchain Culture Launchpad

Responsive, motion-rich token discovery interface built with React, Vite and GSAP.

## Local development
Install dependencies with `npm install`, then start with `npm run dev`.

## Build
Run `npm run build` to generate the production site in `dist`.

## Cloudflare Pages
- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Root directory: `/`
- Production branch: `main`

Connect the Pages production branch to `main` so new commits deploy automatically.

## Brand identity
The R lettermark has been replaced with an original vector mascot: a small luminous onchain creature with a dark face, cyan eyes and acid-green body. The SVG is embedded in the React UI and scales for the header, footer and hero artwork.

## Current prototype
- Responsive desktop and mobile layout
- Animated hero and orbit artwork
- Trending, New and Watchlist explorer tabs
- Token and chain search
- Dynamic chain filter based on Clanker feed
- Watchlist saved in browser local storage
- Token detail modal with Clanker market records
- Wallet and launch-token preview dialogs

## Important
The token explorer connects to Clanker's public Trending API. Wallet authentication, token creation, trading and backend persistence are not connected. Market data can be delayed or incomplete; verify token details and contract addresses independently before trading.

## Clanker market feed

The explorer fetches the top 10 records from Clanker's public Trending endpoint:

`https://www.clanker.world/api/tokens/trending`

No API key or Cloudflare environment variable is required. The page refreshes the feed every 30 seconds and falls back to clearly labeled sample records if the API request fails. The browser request requires Clanker's endpoint to allow CORS.

`src/market.js` normalizes token metadata and market fields from the API response. The Live indicator means the endpoint responded successfully; it does not verify token safety, contract authenticity, or guarantee that every market field is present.

Official Clanker API documentation: https://github.com/clanker-devco/DOCS/blob/main/api-reference/public/README.md
