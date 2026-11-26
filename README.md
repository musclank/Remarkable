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

Connect the Pages production branch to `main) so new commits deploy automatically.

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
