# DOOM INDEX

DOOM INDEX is a Cloudflare-first generative art project. It turns live crypto market context into paintings, stores the resulting image on Arweave via ArDrive Turbo during recurring generation, and uploads the framed GLB plus NFT metadata only when a mint happens. D1 indexes the artwork and caches mint-time GLB refs for the web UI, archive, OGP, and mint flow.

## Overview

- Frontend: Next.js 16 App Router
- Runtime: Cloudflare Workers via `vinext` + Vite
- Storage: Arweave for artwork assets, D1 for searchable metadata
- Generation inputs: CoinGecko, Fear & Greed, Tavily, Runware
- Minting: custom Doom NFT program on Solana

## Arweave History

Historical items uploaded from the current DOOM INDEX Arweave address:

- Address: `w-0BSqoDiZoct2ISCa1uSCgjm374kFE9hJwKMzAKJ-s`
- ViewBlock: <https://viewblock.io/arweave/address/w-0BSqoDiZoct2ISCa1uSCgjm374kFE9hJwKMzAKJ-s?tab=items>

## Local Setup

Install dependencies:

```bash
bun install
```

Copy `.example.vars` to `.dev.vars`, then fill in the required values:

```bash
cp .example.vars .dev.vars
```

Minimum local env:

```bash
NEXT_PUBLIC_BASE_URL=http://localhost:8787
RUNWARE_API_KEY=your_runware_api_key
ARDRIVE_TURBO_SECRET_KEY='{"kty":"RSA", ...}'
```

Common optional env:

```bash
COINGECKO_API_KEY=your_coingecko_api_key
TAVILY_API_KEY=your_tavily_api_key
ARWEAVE_GATEWAY_BASE_URL=https://permagate.io
```

`bun run dev` uses the local app dev server. Point `.env.local` at `.dev.vars` so the app and the Bun scripts share the same values:

```bash
ln -s .dev.vars .env.local
```

## Development

Run the Next.js app:

```bash
bun run dev
```

Run the Cloudflare Worker dry-run build:

```bash
bun run build:cf
```

Trigger the cron loop locally:

```bash
bun run watch-cron
```

Generate a painting locally:

```bash
bun run generate:img
```

Generate the framed GLB directly:

```bash
bun run generate:framed-glb --image ./out/example.webp --out ./out/framed.glb
```

## Arweave Uploads

Upload an explicit image + GLB bundle to Arweave:

```bash
bun --env-file=.dev.vars scripts/upload-metadata-ardrive.ts \
  --token-id 1 \
  --thumbnail ./out/example.webp \
  --glb ./out/framed.glb
```

Upload the built-in placeholder fixture bundle:

```bash
bun --env-file=.dev.vars scripts/upload-metadata-ardrive.ts \
  --token-id 1 \
  --fixture
```

## Database

Generate and apply Drizzle migrations:

```bash
bun run db:generate
bun run db:migrate
```

Production migration and deployment commands:

```bash
bun run db:migrate:prod
bun run deploy
```

## Verification

```bash
bun run lint
bun run typecheck
bun run test
```

Focused test commands:

```bash
bun run test:unit
bun run test:integration
```

## Project Docs

- [docs/PRODUCT.md](docs/PRODUCT.md)
- [docs/TECH.md](docs/TECH.md)
- [docs/STRUCTURE.md](docs/STRUCTURE.md)
