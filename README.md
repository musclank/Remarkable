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
- Solana/Base chain filter
- Watchlist saved in browser local storage
- Token detail modal with demo metrics and sample chart
- Wallet and launch-token preview dialogs

## Important
All token names, prices, market caps, volume, charts and addresses shown in this prototype are sample data. Live market feeds, wallet authentication, token creation, trading, verified onchain token details, and backend persistence are not connected yet. Do not treat demo values as financial data.

## Market data adapter

The explorer now reads market records through `src/market.js`. It uses the built-in sample tokens when no API URL is configured. To connect a compatible feed, add `VITE_MARKET_API_URL` to the Cloudflare Pages environment variables and provide an endpoint returning either an array of token objects or an object containing `tokens`, `data`, or `results` as an array.

Each record can provide `name`, `symbol`, `chain` or `network`, `description`, `marketCap` or `market_cap` or `fdv`, `volume24h` or `volume_24h` or `volume`, `priceChange24h` or `change24h`, and `address` or `mint` or `contractAddress`. The adapter normalizes these into the explorer card fields. The endpoint must be publicly accessible from the browser and support CORS. Keep any private API secret on a server-side proxy; Vite `VITE_` variables are exposed in the client bundle.

The UI marks data as live only when the configured endpoint responds successfully. It falls back to sample data and displays an error message if the request fails. A successful API response does not itself verify token safety or contract authenticity.
