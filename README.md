# DOOM INDEX

A decentralized archive of financial emotions. AI generates one painting every minute, translating the collective psychology of 8 pump.fun tokens into visual art.

## Overview

DOOM INDEX tracks 8 indicator tokens on Solana (`$CO2`, `$ICE`, `$FOREST`, `$NUKE`, `$MACHINE`, `$PANDEMIC`, `$FEAR`, `$HOPE`) and generates a unique artwork every minute based on their market cap values.

## Development

### Setup

```bash
bun install
```

### Environment Variables

Create a `.env` file:

```bash
# Image Generation Provider
IMAGE_PROVIDER=smart  # Options: smart (recommended), ai-sdk, runware-sdk

# Log Level (optional, exposed to client)
# Options: ERROR, WARN, INFO, DEBUG, LOG
# Default: DEBUG in development, INFO in production
# NEXT_PUBLIC_LOG_LEVEL=DEBUG

# Cloudflare R2 Storage (required for production)
R2_PUBLIC_DOMAIN=https://doom-index-storage.r2.dev

# Provider API Keys (configure based on your chosen provider)
OPENAI_API_KEY=your_key_here   # For OpenAI models (dall-e-3, etc.)
RUNWARE_API_KEY=your_key_here  # For Runware/CivitAI models
```

For Cloudflare Workers, create a `.dev.vars` file:

```bash
# Provider API Key for Cloudflare Workers
PROVIDER_API_KEY=your_runware_api_key_here

# R2 Batch Upload (optional, for faster OpenNext build/deploy)
# These variables enable faster batch upload for remote R2 during build/deploy
# Get these values from Cloudflare Dashboard:
# 1. R2 API Tokens: https://dash.cloudflare.com/<account-id>/r2/api-tokens
# 2. Account ID: Found in Cloudflare Dashboard URL or Workers overview
# R2_ACCESS_KEY_ID="your_r2_access_key_id"
# R2_SECRET_ACCESS_KEY="your_r2_secret_access_key"
# CF_ACCOUNT_ID="your_cloudflare_account_id"
```

**Note**: `mock` provider is for testing only and not available in production.

**Note**: R2 batch upload environment variables are optional. If not set, OpenNext will use slower individual uploads but functionality will still work.

### Running the App

```bash
# Development (Next.js)
bun run dev

# Development (Cloudflare Workers Preview - Local R2)
bun run preview

# Development (Cloudflare Workers Cron)
# Start preview with --test-scheduled flag
bun run preview -- --test-scheduled

# Automatically trigger cron every minute (starting at :00 seconds)
# This script waits until the next minute (0 seconds) and then triggers every 60 seconds
bun run watch-cron

# Or trigger cron manually via curl
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"

# Or use wrangler dev command
bun run wrangler:dev

# Deploy to Cloudflare
bun run deploy
bun run wrangler:deploy
```

### Testing

```bash
# Run all tests (requires IMAGE_PROVIDER env var)
IMAGE_PROVIDER=smart bun test

# Type checking
bun run typecheck
```

## Image Generation Script

Generate images locally using the CLI script with weighted prompts:

### Basic Usage

```bash
# Generate with default settings (smart provider, all tokens at 1M)
IMAGE_PROVIDER=smart bun scripts/generate.ts

# Generate with custom market cap values (recommended format)
IMAGE_PROVIDER=smart bun scripts/generate.ts \
  --mc "CO2=1300000,ICE=200000,FOREST=900000,NUKE=50000,MACHINE=1450000,PANDEMIC=700000,FEAR=1100000,HOPE=400000"

# Generate with specific model (OpenAI)
IMAGE_PROVIDER=smart bun scripts/generate.ts --model "dall-e-3" --w 1024 --h 1024

# Generate with Runware/CivitAI model
IMAGE_PROVIDER=smart bun scripts/generate.ts --model "civitai:38784@44716"

# Use mock provider for testing (no API key required)
IMAGE_PROVIDER=smart bun scripts/generate.ts --provider mock

# Custom dimensions and format
IMAGE_PROVIDER=smart bun scripts/generate.ts --w 1280 --h 720 --format webp

# Custom output directory
IMAGE_PROVIDER=smart bun scripts/generate.ts --output ./my-outputs
```

### Available Options

- `--provider <name>`: Image provider (smart, ai-sdk, runware-sdk, mock) - default: smart
- `--model <name>`: Model name (dall-e-3, runware:100@1, civitai:xxx@xxx, etc.)
- `--mc <values>`: Market cap values (format: "TOKEN=value,...") - default: all 1,000,000
- `--seed <string>`: Custom seed for reproducibility - default: generated from MC
- `--w, --width <num>`: Image width - default: 1280
- `--h, --height <num>`: Image height - default: 720
- `--format <fmt>`: Output format (webp, png) - default: webp
- `--output <path>`: Output directory - default: ./scripts/.out
- `--help`: Show help message

**Note**: Market cap values are normalized with threshold 1,000,000 (1M). Values are converted to weights (0.01-1.50) for prompt generation.

### Output

The script creates a folder for each generation:

```
scripts/.out/DOOM_<timestamp>_<hash>_<seed>/
├── image.webp      # Generated image
└── params.json     # Generation parameters and metadata
```

The `params.json` includes:

- Prompt and negative prompt
- Visual parameters
- Market cap values
- Seed and hash
- Provider information
- File size
- Timestamp

## Cron Watcher Script

For local development, use the cron watcher script to automatically trigger scheduled cron jobs:

### Basic Usage

```bash
# Start cron watcher (runs every minute starting at :00 seconds)
bun run watch-cron

# Custom port
bun run watch-cron --port 8787

# Custom interval (in seconds)
bun run watch-cron --interval 60

# Custom cron expression
bun run watch-cron --cron "0 * * * *"
```

### Available Options

- `--port, -p <number>`: Server port (default: 8787)
- `--interval, -i <number>`: Interval in seconds (default: 60)
- `--cron, -c <string>`: Cron expression (default: "0 \* \* \* \*")
- `--help, -h`: Show help message

**Note**: The script waits until the next minute (0 seconds) before starting, then executes every 60 seconds. This matches Cloudflare Workers cron trigger behavior.

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router, Edge Runtime)
- **Hosting**: Cloudflare Pages + Workers
- **Scheduling**: Cloudflare Cron Triggers (every minute)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **3D Rendering**: React Three Fiber + Three.js
- **Data Fetching**: TanStack Query + tRPC (end-to-end type safety)
- **API**: tRPC v11 (type-safe RPC framework)
- **Error Handling**: neverthrow (Result type)
- **Image Generation**: Runware (default) / OpenAI (via AI SDK)
- **Runtime**: Bun (local), workerd (Cloudflare)

### Cloudflare R2 Storage

The application uses Cloudflare R2 for persistent storage:

- **Production (Workers)**: Uses R2 Binding for direct bucket access
- **Production (Next.js)**: Uses public URLs for read-only access
- **Development/Test**: Uses in-memory implementation for fast local development

#### Storage Structure

```
r2://doom-index-storage/
├── state/
│   ├── global.json           # Global state (prevHash, lastTs, imageUrl)
│   └── {ticker}.json         # Per-token state (thumbnailUrl, updatedAt)
├── images/
│   └── DOOM_*.webp           # Generated images
└── revenue/
    └── {minuteIso}.json      # Revenue reports
```

#### Key Features

- **Result-based error handling**: All R2 operations return `Result<T, AppError>` for type-safe error handling
- **Dual environment support**: Workers use R2 Binding, Next.js uses public URLs
- **Batch operations**: Efficient parallel writes for multiple state updates
- **Type safety**: Full TypeScript support with Cloudflare Workers types
- **Testing**: Seamless switching between production and test implementations

### Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── api/          # API routes
│   │   └── trpc/     # tRPC HTTP endpoint
│   └── page.tsx      # Main gallery page
├── components/       # React components
│   ├── gallery/      # 3D scene components
│   ├── ui/           # UI components
│   └── providers/    # Context providers
├── hooks/            # Custom React hooks (tRPC integrated)
├── lib/              # External integrations
│   ├── trpc/         # tRPC clients (React, Server, Vanilla)
│   ├── providers/    # Image generation providers
│   └── r2.ts         # Cloudflare R2 client
├── server/           # Server-side code
│   └── trpc/         # tRPC routers and schemas
│       ├── context.ts      # Context creation
│       ├── trpc.ts         # tRPC initialization
│       ├── schemas/        # zod schemas
│       └── routers/        # Domain routers
├── services/         # Business logic
│   └── container.ts  # Service factory (Workers/Next.js)
├── constants/        # Configuration
├── types/            # TypeScript types
└── utils/            # Utilities

workers/
└── cron.ts           # Cloudflare Cron Trigger handler

scripts/
├── generate.ts       # Image generation script
└── watch-cron.ts     # Cron watcher for local development

wrangler.toml         # Cloudflare Workers configuration
open-next.config.ts   # Next.js on Cloudflare Pages configuration
```

### tRPC API

The project uses tRPC v11 for end-to-end type safety. All API endpoints are exposed as type-safe procedures:

- **Market Cap**: `trpc.mc.getMarketCaps.useQuery()`
- **Viewer**: `trpc.viewer.register.mutate()`, `trpc.viewer.remove.mutate()`
- **Token State**: `trpc.token.getState.useQuery({ ticker })`
- **R2 Objects**: `trpc.r2.getObject.useQuery({ key })`

See [tRPC Architecture Documentation](./docs/trpc-architecture.md) and [Migration Guide](./docs/trpc-migration.md) for details.

## Prompt Templates

Prompt templates are defined in `src/constants/prompts.ts` and shared across all image generation providers.

### Available Templates

- **default**: Detailed surreal oil painting prompt with comprehensive visual parameters
- **experimental**: Abstract expressionist style for testing new approaches

You can create your own template by adding it to `src/constants/prompts.ts`.

## Deployment

### Cloudflare Setup

1. **Create R2 Bucket**

   ```bash
   wrangler r2 bucket create doom-index-storage
   ```

2. **Set Workers Secrets**

   ```bash
   wrangler secret put PROVIDER_API_KEY
   ```

3. **Deploy Workers**

   ```bash
   bun run wrangler:deploy
   ```

4. **Deploy Next.js to Cloudflare Pages**
   ```bash
   bun run deploy
   ```

### Environment Variables (Production)

Set these in Cloudflare Dashboard:

- **Pages**: `R2_PUBLIC_DOMAIN`
- **Workers**: `PROVIDER_API_KEY` (via Secrets)

**Optional - R2 Batch Upload (for faster builds)**:

To enable faster batch uploads during OpenNext build/deploy, set these environment variables in your CI/CD or build environment:

- `R2_ACCESS_KEY_ID`: R2 API Token Access Key ID (create at https://dash.cloudflare.com/<account-id>/r2/api-tokens)
- `R2_SECRET_ACCESS_KEY`: R2 API Token Secret Access Key
- `CF_ACCOUNT_ID`: Your Cloudflare Account ID (found in Dashboard URL or Workers overview)

These are optional - builds will work without them but may be slower.

## Image Providers

### Mock Provider

No API key required. Returns empty image buffer for testing.

```bash
IMAGE_PROVIDER=mock
```

### Runware

Fast, Edge-compatible image generation (default provider).

```bash
IMAGE_PROVIDER=runware
RUNWARE_API_KEY=your_key_here
```

### OpenAI

DALL-E 2 via OpenAI API.

```bash
IMAGE_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

## License

MIT
