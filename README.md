# DOOM INDEX

Real-time visualization of world indicators through generative art on Solana.

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

# Prompt Template
PROMPT_TEMPLATE=default  # Options: default, experimental

# Log Level (optional)
# Options: ERROR, WARN, INFO, DEBUG, LOG
# Default: DEBUG in development, INFO in production
# LOG_LEVEL=DEBUG

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
```

**Note**: `mock` provider is for testing only and not available in production.

### Running the App

```bash
# Development (Next.js)
bun run dev

# Development (Cloudflare Workers Cron)
bun run wrangler:dev

# Build for Cloudflare Pages
bun run preview

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

## Architecture

### Tech Stack

- **Framework**: Next.js 16 (App Router, Edge Runtime)
- **Hosting**: Cloudflare Pages + Workers
- **Scheduling**: Cloudflare Cron Triggers (every minute)
- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **3D Rendering**: React Three Fiber + Three.js
- **Data Fetching**: React Query
- **Error Handling**: neverthrow (Result type)
- **Image Generation**: Runware / Replicate / OpenAI (via AI SDK)
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
│   ├── api/          # API routes (read-only, Edge)
│   └── page.tsx      # Main gallery page
├── components/       # React components
│   ├── gallery/      # 3D scene components
│   ├── ui/           # UI components
│   └── providers/    # Context providers
├── hooks/            # Custom React hooks
├── lib/              # External integrations
│   ├── providers/    # Image generation providers
│   └── r2.ts         # Cloudflare R2 client
├── services/         # Business logic
│   └── container.ts  # Service factory (Workers/Next.js)
├── constants/        # Configuration
├── types/            # TypeScript types
└── utils/            # Utilities

workers/
└── cron.ts           # Cloudflare Cron Trigger handler

scripts/
└── generate.ts       # Image generation script

wrangler.toml         # Cloudflare Workers configuration
open-next.config.ts   # Next.js on Cloudflare Pages configuration
```

## Prompt Templates

Prompt templates are defined in `src/constants/prompts.ts` and shared across all image generation providers.

### Available Templates

- **default**: Detailed surreal oil painting prompt with comprehensive visual parameters
- **experimental**: Abstract expressionist style for testing new approaches

### Using Custom Templates

Set the `PROMPT_TEMPLATE` environment variable:

```bash
PROMPT_TEMPLATE=experimental
```

Or create your own template by adding it to `src/constants/prompts.ts`.

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

## Image Providers

### Mock Provider

No API key required. Returns empty image buffer for testing.

```bash
IMAGE_PROVIDER=mock
```

### Runware

Fast, Edge-compatible image generation.

```bash
IMAGE_PROVIDER=runware
RUNWARE_API_KEY=your_key_here
```

### Replicate

Stable Diffusion XL via Replicate API.

```bash
IMAGE_PROVIDER=replicate
REPLICATE_API_KEY=your_key_here
```

### OpenAI

DALL-E 2 via OpenAI API.

```bash
IMAGE_PROVIDER=openai
OPENAI_API_KEY=your_key_here
```

## License

MIT
