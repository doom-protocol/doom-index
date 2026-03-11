# OpenNextJS Cloudflare Environment Variables Issue

## Problem Description

When using OpenNextJS Cloudflare (`bun run preview`), there is a specific issue with environment variable detection that affects local development of Cloudflare Workers applications.

## Root Cause

OpenNextJS Cloudflare **intentionally disables** `.env` file loading in Wrangler processes to avoid conflicts between Next.js and Wrangler environment variable handling.

### Technical Details

In `packages/cloudflare/src/cli/utils/run-wrangler.ts`, the following environment variable is set:

```typescript
env: {
  ...process.env,
  // `.env` files are handled by the adapter.
  // Wrangler would load `.env.<wrangler env>` while we should load `.env.<process.env.NEXTJS_ENV>`
  // See https://opennext.js.org/cloudflare/howtos/env-vars
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
},
```

This setting prevents Wrangler from automatically loading `.env` files, causing issues when:

1. **Build-time environment variables**: Next.js build process (`next build`) sets `NODE_ENV="production"` by default
2. **Runtime environment variables**: Cloudflare Workers injects environment variables from `wrangler.toml` or `.dev.vars` at runtime
3. **Type-safe env validation**: `src/env.ts` uses `t3-env` which relies on `process.env` values at import time

## Affected Scenarios

### 1. `bun run preview` (OpenNextJS Cloudflare Preview)

- **Issue**: `NODE_ENV` appears as `"production"` in Worker runtime due to Next.js build optimization
- **Impact**: Development environment detection fails, causing features like duplicate generation skipping to not work as expected
- **Workaround**: Use `NEXTJS_ENV=development` in `.dev.vars` instead of relying on `NODE_ENV`

### 2. `wrangler dev` (Direct Wrangler)

- **Works correctly**: Environment variables from `.dev.vars` are properly loaded
- **No issues**: `NODE_ENV=development` is correctly detected

## Solutions

### Option 1: Use `NEXTJS_ENV` Instead of `NODE_ENV`

1. Update `.dev.vars`:

```bash
NODE_ENV=development
NEXTJS_ENV=development  # Add this
```

2. Update code to check `NEXTJS_ENV`:

```typescript
// Instead of
if (process.env.NODE_ENV === "development") { ... }

// Use
if (env.NEXTJS_ENV === "development") { ... }
```

### Option 2: Keep `.example.vars` as the template and `.dev.vars` as the local source of truth

1. Copy `.example.vars` to `.dev.vars`:

```bash
cp .example.vars .dev.vars
```

2. Run local Bun / preview commands with `--env-file=.dev.vars` when they need Bun-side env injection

3. Symlink `.env.local` to `.dev.vars` so plain `next dev` picks up the same values

```bash
ln -s .dev.vars .env.local
bun run dev
```

This keeps `next dev` aligned with the same `.dev.vars` file the Bun scripts and Wrangler preview use, without adding a custom bootstrap layer.

### Option 3: Update `wrangler.toml` with Explicit Environment Variables

Add explicit `[vars]` section to `wrangler.toml`:

```toml
[vars]
NODE_ENV = "production"
LOG_LEVEL = "INFO"

[env.dev.vars]
NODE_ENV = "development"
LOG_LEVEL = "DEBUG"
```

## Current Workaround

The codebase currently uses `NEXTJS_ENV` for development environment detection:

```typescript
// In painting-generation-orchestrator.ts
const isDev = env.NEXTJS_ENV === "development" || process.env.NODE_ENV === "development";
```

This provides fallback detection for both OpenNextJS preview and direct Wrangler development scenarios.

## References

- [OpenNextJS Cloudflare Environment Variables Documentation](https://opennext.js.org/cloudflare/howtos/env-vars)
- [Cloudflare Wrangler Environment Variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)
- [Next.js Environment Variables](https://nextjs.org/docs/pages/guides/environment-variables)
