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
- Wallet-connected Clanker v5 token deployment using the official SDK
- Token logo upload to IPFS through a Cloudflare Pages Function
- Onchain launch review, wallet confirmation, transaction status and BaseScan / Clanker links

## Important
The token explorer combines Clanker's public Trending API with DexScreener's latest Base token profiles and boost feed. The merged feed prioritizes Base token records while retaining other Clanker trending tokens, so Base assets are not crowded out by tokens on other networks. Wallet connection uses the browser's EIP-1193 provider. Token deployment is performed client-side through the official Clanker v5 SDK; signing and transaction approval stay in the user's wallet. Market data can be delayed or incomplete; verify token details and contract addresses independently before trading.

## Clanker market feed

The explorer fetches Clanker trending records and enriches the list with Base tokens found through DexScreener's latest boosts and token profiles, then returns up to 20 combined records:

`https://www.clanker.world/api/tokens/trending`

No API key or Cloudflare environment variable is required. The page refreshes the feed every 30 seconds and shows an explicit unavailable state if the API request fails. The browser request requires Clanker's endpoint to allow CORS.

`src/market.js` normalizes token metadata and market fields from the API response, including common image/logo fields and IPFS image URLs. Token artwork falls back to a symbol initial if an image is missing or fails to load. The Live indicator means the endpoint responded successfully; it does not verify token safety, contract authenticity, or guarantee that every market field is present.

Official Clanker API documentation: https://github.com/clanker-devco/DOCS/blob/main/api-reference/public/README.md


## Live token price

The token detail modal requests current USD token price and 24-hour change from DexScreener through the Cloudflare Pages Function at `/api/market/chart`. The function selects the highest-liquidity matching pair on Base, Solana or Ethereum and also displays available liquidity and 24-hour volume. This view intentionally shows a live quote rather than OHLCV history because DexScreener's public token API provides pair market data, not a public candle-history endpoint. Quotes may be delayed or unavailable for newly listed tokens.

No API key or environment variable is required for DexScreener's public endpoint.


## Clanker SDK token launches

The Launch token flow uses the official `clanker-sdk/v5` package and `viem` on Base mainnet. It submits the launch transaction from the connected wallet, waits for confirmation, and displays the resulting token address and transaction links.

Launch defaults are shown in the review screen before the user signs: 1% buy tax, 1% sell tax, native ETH pool, 100% creator reward allocation to the connected wallet, editable metadata and anti-sniping enabled. The user pays the network / launch costs from their own wallet and must verify the settings in their wallet before approving.

Token logo files are pinned to IPFS through `functions/api/launch/upload.js`. Configure a Pinata JWT as a Cloudflare Pages secret / environment variable named `PINATA_JWT` (Production and Preview as needed). Do not place the JWT in frontend code or commit it to GitHub. Without this secret, image upload and token launch will stop with a configuration message.

Official SDK: https://github.com/clanker-devco/clanker-sdk
Clanker v5 documentation: https://github.com/clanker-devco/DOCS/blob/main/references/core-contracts/v5.md

## DEX swap handoff

The explorer includes a DEX Swap modal for BNB Chain and Base. BNB Chain opens the official PancakeSwap app; Base opens the official Uniswap app. Token contract addresses from supported EVM token detail views can be prefilled. REMARKABLE does not custody funds or execute trades in its own app; users review and sign every transaction in the DEX and their wallet. Solana tokens are not routed through this EVM swap flow.

## Platform information pages

The site footer includes in-app Docs, About, Terms of Use, and Privacy Notice dialogs. The documentation describes token exploration, launch review, third-party market data, and the BNB Chain / Base DEX handoff. Terms and privacy content are general platform notices and should be reviewed by qualified counsel before treating them as final legal documents.
