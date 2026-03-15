---
title: vinext evaluation groundwork
updated: 2026-03-15
---

## Goal

Keep `Next.js + OpenNext` as the production path while reducing the repo-specific migration surface for a future `vinext` spike.

## What changed

- Added [`src/lib/cloudflare-context.ts`](../../src/lib/cloudflare-context.ts) as the single web-path entrypoint for resolving Cloudflare bindings.
- Moved these web/runtime callers off direct `@opennextjs/cloudflare` imports:
  - [`src/server/db/index.ts`](../../src/server/db/index.ts)
  - [`src/server/trpc/context.ts`](../../src/server/trpc/context.ts)
  - [`src/lib/workers-ai-client.ts`](../../src/lib/workers-ai-client.ts)
  - [`src/app/archive/page.tsx`](../../src/app/archive/page.tsx)
  - [`src/app/archive/[id]/page.tsx`](../../src/app/archive/[id]/page.tsx)
  - [`src/app/opengraph-image.tsx`](../../src/app/opengraph-image.tsx)
- Added `bun run vinext:check` as a non-default compatibility probe.

## Why this matters for `vinext`

The largest web-path coupling to OpenNext was not just the build scripts. It was the repeated direct use of `getCloudflareContext()` across pages, DB setup, tRPC context, and Workers AI access.

By centralizing Cloudflare binding resolution:

- a `vinext` spike only needs to swap one resolver boundary for the web app
- the production OpenNext path stays unchanged at the deployment layer
- repo-specific compatibility work can be measured separately from cron migration

## Remaining migration blockers

- `src/worker.ts` still couples the deployed worker to both OpenNext `fetch` handling and `scheduled()` cron handling.
- `next.config.ts` still contains OpenNext/webpack-specific bundle stubbing that must be re-expressed or removed for Vite.
- `open-next.config.ts` and the OpenNext patch scripts remain part of the production deploy path.
- `next/image`, middleware, dynamic OGP, and MDX still need direct `vinext` validation.

## Recommended next commands

```bash
bun run vinext:check
```

If the check is promising, do the actual spike in an isolated branch/worktree:

1. Keep the current OpenNext scripts as the default.
2. Add `vite.config.ts` and `vinext` app wiring in parallel.
3. Leave cron out of the first spike and treat it as a separate worker boundary.
