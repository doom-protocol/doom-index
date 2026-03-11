Viewer count server snapshot loop fix:

- [x] Load project steering docs and relevant lessons
- [x] Inspect `useViewerCount`, `viewerCountStore`, and related call sites
- [x] Add a focused failing regression test for the SSR `getServerSnapshot` path
- [x] Cache the empty server snapshot used by `useSyncExternalStore`
- [x] Run targeted verification plus lint/typecheck as needed
- [x] Add a short review summary with verification results

Review:

- `useViewerCount` now reuses a module-level empty snapshot for `getServerSnapshot`, which removes the unstable object identity that triggered React's infinite-loop warning during hydration.
- Added a hydration regression test that failed against the old hook and now stays green.
- Cleared the existing test-gate issues surfaced during verification by aligning two test files with explicit `Root` typing and fixing one type-only import style violation.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/hooks/use-viewer-count.test.tsx`, `bun run format`, `bun run lint`, `bun run typecheck`

---

Local vars-file alignment:

- [x] Load project steering docs and inspect the local dev failure
- [x] Confirm the repo now uses `.dev.vars` for local runs and `.example.vars` as the committed template
- [x] Replace remaining `.env.local` / `.env.example` script references with the new vars-file convention
- [x] Keep strict env validation and scope the fix to vars-file wiring only
- [x] Verify `bun run preview` and `bun run dev` boot without the previous env validation crash
- [x] Add a short review summary with verification results

Review:

- Local Bun helper scripts now read `.dev.vars`, and test scripts now read `.example.vars`, matching the current repo files instead of the removed `.env.local` / `.env.example`.
- `bun run preview` now injects `.dev.vars` and keeps `--env=dev`, so Wrangler receives both the local secrets and the `env.dev` bindings/vars from `wrangler.toml`.
- `bun run dev` runs `next dev` through Bun with `.dev.vars`, and `tsconfig.json` includes the extra Next 16 dev types path so the command stops rewriting the file on every launch.
- Verification: `bun run preview` reached a live `workerd` listener on `127.0.0.1:8787` with `curl -I` returning `200 OK`, and `bun run dev` reached `Ready` on port `3000` without reconfiguring `tsconfig.json`.

---

Update PR #35 plan:

- [x] Load project steering docs
- [x] Inspect current local diff and prior CI failures
- [x] Run local lint, typecheck, and test against the pending fixes
- [x] Apply any remaining minimal CI fixes
- [x] Replace workaround-style fixes with root-cause fixes
- [ ] Commit and push the PR update
- [ ] Monitor GitHub checks and summarize results

---

Review fixes for Cloudflare binding regressions:

- [x] Load project steering docs and inspect the reviewed files
- [x] Add focused failing tests for GLB mock ordering and missing `DB` / `R2_BUCKET` / `AI` bindings
- [x] Restore explicit binding guards in `src/db/index.ts`, `src/lib/r2.ts`, and `src/lib/workers-ai-client.ts`
- [x] Update CI path filters to watch `.env.example`
- [x] Run targeted tests plus final `format`, `lint`, and `typecheck`
- [x] Add a short review summary with verification results

Review:

- Restored the explicit missing-binding guards for `env.DB`, `env.R2_BUCKET`, and `env.AI`, preserving the previous clear configuration errors instead of falling through to opaque runtime failures.
- Repaired the GLB unit test harness so `three-stdlib` is mocked before `glb-export-service` is imported, which restores isolation for the exporter/loader tests.
- Updated the CI path filters to watch `.env.example`, matching the current test command inputs.
- Added focused regression tests for the missing Cloudflare bindings and reran the existing GLB suite.
- Verification: `bun test --env-file=.env.example --preload=./tests/preload.ts tests/unit/db/index.test.ts tests/unit/lib/r2.test.ts tests/unit/lib/workers-ai-client-cloudflare.test.ts tests/unit/lib/glb-export-service.test.ts`, `bun run test --bail`, `bun run format`, `bun run lint`, `bun run typecheck`

---

Top page initial load performance issue investigation:

- [x] Load project steering docs
- [x] Inspect top page, gallery, texture loading, and R2 delivery code paths
- [x] Validate likely bottlenecks with local runtime or build artifacts
- [x] Draft issue with evidence, root-cause hypotheses, and prioritized fixes
- [x] Add review notes and verification summary

Review:

- Created GitHub issue: #37 `Top page 初回ロードで画像と GLTF の表示が遅い`
- Saved local draft and investigation notes at `docs/analysis/top-page-initial-load-performance-issue.md`
- Confirmed likely bottlenecks from code and artifacts:
  - `public/frame.glb` is about 10MB
  - `public/placeholder-painting.webp` is about 2.3MB and bypasses image resizing because it is a public asset
  - latest painting metadata is fetched only after client hydration
  - root providers pull Solana and related dependencies into the initial client bundle
- Local Cloudflare preview showed additional ~12s latency on `/` and `/api/trpc/paintings.list`, but app logs indicate the underlying tRPC procedure itself was fast, so preview overhead was called out as a caveat rather than treated as the primary product bug

---

Review checklist handoff:

- [ ] Load project memory from docs and task memory for review context
- [ ] Inspect diff against merge base and identify changed files
- [ ] Analyze changed code for discrete, actionable bugs and verify impacted behavior
- [ ] Produce prioritized review findings in the required JSON format

---

Refactor server layout PR handoff:

- [x] Reconcile branch choice for the server layout refactor PR and include the extra commit per latest user instruction
- [x] Run final `format`, `lint`, `typecheck`, and targeted review on the branch that will back the PR
- [x] Review the full PR diff and confirm the description covers all commits in the branch
- [in-progress] Create or update the GitHub PR, then monitor CI until green or a concrete blocker appears
- [x] Record the final review summary and verification results here

Review:

- Combined the server-layout refactor commit with the previously separated dependency-and-analysis commit so the PR reflects the user's latest "include everything" instruction.
- Verified that the transient `baseline-browser-mapping` warning no longer reproduces after Bun re-resolved the lockfile, so no lint-script env var suppression is needed.
- Final verification passed with `bun run format`, `bun run lint`, `bun run typecheck`, and `bun run test` (`477 pass / 13 skip / 0 fail`).

Strict env simplification pass:

- [x] Remove workaround-style build env/script toggles from package.json and workflow
- [x] Find remaining build-time Cloudflare context access causing analyzer failure
- [x] Fix root cause with minimal code changes and comments
- [x] Re-run build/lint/typecheck/targeted tests

Review:

- `next.config.ts` no longer treats a localhost public URL as a signal to initialize OpenNext dev bindings. The dev-only Cloudflare bootstrap is now limited to development mode, with an inline comment explaining why CI/build must not hit Wrangler remote bindings.
- Removed the `DOOM_ENABLE_SERVER_BUNDLE_STUBS` toggle and the global webpack stub aliasing. The current import graph already keeps those heavy/browser packages behind client boundaries, so the env-driven workaround was just obscuring the real build bug.
- Cleaned the last dead reference to the deleted stub file from `knip.json`.
- Verification passed with `bun run build:cf`, `bun run lint`, and `bun run typecheck`.

---

Next generation env cleanup:

- [x] Re-check the branch after learning the CI build failure was missing build-time env configuration
- [x] Remove issue-unrelated branch noise and keep strict env validation
- [x] Scope OpenNext bundle stubs so normal SSR builds keep real modules
- [x] Re-run local `build`, `build:cf`, `lint`, `typecheck`, targeted tests, and bundle analysis
- [ ] Commit, push, and watch PR #44 checks

Review:

- Kept `src/env.ts` strict and removed the temptation to reintroduce `skipValidation`; the confirmed failure mode was CI/build config, not runtime code.
- Kept the `Pinata` cleanup that moves `PINATA_JWT` access back to the server router and leaves the client helper free of server-only env access.
- Scoped the webpack stubs back to the OpenNext worker build path in `next.config.ts`, with comments explaining that normal Next SSR must use the real modules.
- Dropped the extra `tests/unit/env.test.ts` addition and reverted the unrelated `.oxfmtrc` branch change so the PR stays focused.
- Verification passed with `bun run build`, `bun run build:cf`, `bun run lint`, `bun run typecheck`, `bun test --env-file=.env.example --preload=./tests/preload.ts tests/integration/services/painting-generation-orchestrator.integration.test.ts tests/unit/components/gallery-scene.test.tsx tests/unit/server/trpc/routers/r2.test.ts tests/integration/app/gallery-page.integration.test.tsx tests/unit/lib/pinata-client.test.ts tests/unit/server/trpc/routers/ipfs.test.ts`, and `bun run analyze:bundle`.

---

Gallery camera lower-bound clamp fix:

- [x] Load project steering docs and inspect gallery camera controls
- [x] Add a regression test for dragging below the floor without collapsing into zoom
- [x] Fix lower-bound handling so camera/target stop together at the floor limit
- [x] Run targeted tests and record review notes

Review:

- Replaced the independent floor clamps in `GalleryScene` with a shared upward offset based on the lower of `camera.position.y` and `target.y`, so downward overflow now stops at the floor without shrinking the camera-target distance.
- Updated the gallery scene regression test to assert that hitting the floor preserves the offset instead of collapsing both values to the same Y, which was the zoom-like failure mode the user reported.
- Verification: `bun test --env-file=.env.example --preload=./tests/preload.ts tests/unit/components/gallery-scene.test.tsx`, `bun run lint`, `bun run typecheck`, `bunx oxfmt --check src/components/gallery/gallery-scene.tsx tests/unit/components/gallery-scene.test.tsx`

---

Local dev env bootstrap fix:

- [x] Reproduce the `bun run dev` failure with Node 25
- [x] Replace the broken `node --env-file` script path with plain `next dev` plus `.env.local` symlink
- [x] Update local dev docs to match the symlink approach
- [x] Verify `bun run dev` starts and loads `.dev.vars`

Review:

- Dropped the bootstrap idea and kept `dev` on plain `next dev`, which is the standard Next.js path.
- Standardized local Next.js startup on `.env.local -> .dev.vars`, so Next.js and the existing Bun / Wrangler flows share one real vars file without an extra wrapper.
- Disabled `withRspack` only for the local `next dev` command in `next.config.ts`, which avoids the current Rspack panic while leaving the configured build path intact.
- Verification: `bun run dev` (`.env.local` detected, `Ready in 789ms`), `bun run lint`, `bun run typecheck`, `bunx oxfmt --check next.config.ts README.md docs/guides/opennextjs-env-vars.md .agents/memory/todo.md .agents/memory/lessons.md`

---

Next config simplification:

- [x] Inspect `next.config.ts` and identify over-abstracted helpers
- [x] Inline trivial dev/build checks and alias mutations without changing behavior
- [x] Verify lint, typecheck, and formatting on the simplified config

Review:

- Removed the shallow helper layer around `next.config.ts` and kept the remaining logic as direct top-level booleans plus in-place `resolve.alias` mutation.
- Kept the `dev` / `build:cf` behavior unchanged while deleting the extra indirection the user called out.
- Verification: `bun run lint`, `bun run typecheck`, `bunx oxfmt --check next.config.ts .agents/memory/todo.md .agents/memory/lessons.md`

---

Top page static-render warning fix:

- [x] Trace the `/` render path to the `headers()`-based server context
- [x] Add focused regression coverage for static server context usage
- [x] Route top-page prefetch through a request-independent static caller
- [x] Run targeted verification and record results

Review:

- Added `createStaticServerContext()` and `createStaticServerCaller()` so request-independent Server Component prefetches can avoid `next/headers`.
- Switched [`src/app/page.tsx`](/Users/asumayamada/Private/doom-protocol/doom-index/src/app/page.tsx) to use the static caller for `paintings.list({ limit: 1 })`, which removes the `/` route's direct dependency on request headers during static generation.
- Added a unit regression for static server context and kept the gallery page integration test green.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/server/trpc/context.test.ts tests/integration/app/gallery-page.integration.test.tsx`, `bun run lint`, `bun run typecheck`, `bunx oxfmt --check src/app/page.tsx src/server/trpc/context.ts src/server/trpc/server-caller.ts tests/unit/server/trpc/context.test.ts tests/integration/app/gallery-page.integration.test.tsx`
- Additional note: `bun run build` was attempted to re-check the exact static-generation log, but local `next build` did not complete cleanly in this environment before verification ended, so the fix was validated by removing the only `headers()` call on the `/` render path plus the targeted tests above.

---

next.config.ts simplification:

- [x] Inspect the current helper-heavy config shape
- [x] Inline trivial helper logic and remove unnecessary alias composition helpers
- [x] Re-run config-focused verification

Review:

- Removed the small abstraction helpers around plugin composition, dev/build detection, and alias merging from `next.config.ts`.
- Kept the remaining behavior visible in place: one `isNextDev` constant, direct alias assignment inside `customizeWebpack`, and direct `createMDX()` / `withRspack()` application at export time.
- Also dropped the config-level `@` alias; the repo already has `@/*` in `tsconfig.json`, so duplicating it in webpack config was unnecessary.

---

PumpFun SVG JSX prop fix:

- [x] Inspect the icon implementation and confirm all invalid JSX SVG props
- [x] Add a focused regression test that fails on React console warnings during icon render
- [x] Replace dashed SVG prop names with React-compatible camelCase props
- [x] Run targeted test, lint, and typecheck
- [x] Add a short review summary with verification results

Review:

- Replaced the dashed SVG JSX props in `PumpFunIcon` with React-compatible camelCase props: `fillRule`, `clipRule`, and `fillOpacity`.
- Added a focused render test that catches React console warnings for invalid SVG props on the icon component.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/components/icons/pump-fun-icon.test.tsx`, `./node_modules/.bin/eslint src/components/icons/pump-fun-icon.tsx tests/unit/components/icons/pump-fun-icon.test.tsx`, `bun run typecheck`

---

Loading indicator hydration mismatch fix:

- [x] Inspect the loading indicator SSR and hydration path
- [x] Add a focused hydration regression test that fails on the mismatch warning
- [x] Remove the component-local styling that injects unstable server-only class names
- [x] Run targeted test, lint, and typecheck
- [x] Add a short review summary with verification results

Review:

- Removed the component-local `styled-jsx` block from `LoadingIndicator`, which was injecting unstable server-rendered markup into the span and causing dev-time SSR/client mismatch noise.
- Moved the loading bar animation keyframes into `src/app/globals.css` and kept the component behavior unchanged apart from referencing the shared `loading-indicator-bar` keyframes.
- Added a server-render regression test that asserts the component no longer injects an inline `<style>` tag into its HTML output.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/components/ui/loading-indicator.test.tsx tests/unit/components/icons/pump-fun-icon.test.tsx`, `./node_modules/.bin/eslint src/components/ui/loading-indicator.tsx src/components/icons/pump-fun-icon.tsx tests/unit/components/ui/loading-indicator.test.tsx tests/unit/components/icons/pump-fun-icon.test.tsx`, `bun run typecheck`, `bunx oxfmt --check src/app/globals.css src/components/ui/loading-indicator.tsx src/components/icons/pump-fun-icon.tsx tests/unit/components/ui/loading-indicator.test.tsx tests/unit/components/icons/pump-fun-icon.test.tsx .agents/memory/todo.md`
- Verification: `bun run lint`, `bun run typecheck`, `bunx oxfmt --check next.config.ts`

---

Env file unification:

- [x] Inspect current env file usage across scripts, docs, and CI
- [x] Switch local scripts to `.dev.vars` and test scripts / CI to `.example.vars`
- [x] Make `next dev` load `.dev.vars` explicitly
- [x] Run verification commands against the updated scripts

Review:

- `package.json` now treats `.dev.vars` as the local source of truth for `dev`, `generate`, `truncate-r2`, `db:migrate`, and `db:push`, while tests read `.example.vars`.
- `bun run dev` now uses Node 24's native `--env-file=.dev.vars` support, which keeps `next dev` aligned with the same file Wrangler/Bun local flows use.
- CI path filters and the test job now watch and load `.example.vars` instead of the deleted `.env.example`.
- Verification: `bun run dev --help`, `bun run test --bail`, `bun run lint`, `bun run typecheck`
- Note: `bun run format` still fails on pre-existing formatting drift in [tsconfig.json](/Users/asumayamada/Private/doom-protocol/doom-index/tsconfig.json), which was outside this env-file change.

---

Gallery camera out-of-range control fix:

- [x] Load project steering docs and relevant bug-fix/TDD guidance
- [x] Inspect the current gallery camera clamp logic and existing regression coverage
- [x] Add failing regression tests for floor overflow, back-wall overflow, and behind-target rotation
- [x] Replace partial clamp behavior with per-frame invalid-move rejection and remove inertial slip
- [x] Run targeted verification and add a short review summary

Review:

- Replaced the gallery OrbitControls bounds handling with per-frame invalid-move rejection. Invalid frames now restore to the last valid snapshot, but the next valid input is accepted immediately, which removes the “controls sometimes stop responding” regression from the earlier drag-lock approach.
- Bounds now cover three cases: below-floor movement, moving beyond the back wall, and rotating the camera behind the target. No front-side wall geometry was added; this stays in camera-control logic only.
- Disabled OrbitControls damping so rejected boundary moves do not keep leaking inertial deltas into later frames.
- Added regression coverage for floor overflow recovery, back-wall overflow, behind-target turns, and the non-damped OrbitControls config.
- Added identity-based structural sharing to `useLatestPainting` so periodic polling does not force a new `PaintingMetadata` reference when the painting is unchanged, which should suppress the periodic scene flicker/re-rendering.
- Removed the 1Hz React state update from `HeaderProgress`; the countdown label now updates through refs/DOM text so the header timer does not schedule a React rerender every second.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/components/gallery-scene.test.tsx tests/unit/hooks/use-latest-painting.test.ts`, `bunx oxfmt --check src/hooks/use-latest-painting.ts tests/unit/hooks/use-latest-painting.test.ts src/components/gallery/gallery-scene.tsx tests/unit/components/gallery-scene.test.tsx`
- Note: repo-wide `lint` and `typecheck` still have pre-existing failures in `tests/unit/server/trpc/server-caller.test.ts`, unrelated to this camera/polling work.

---

Gallery room ceiling removal:

- [x] Add a failing regression test that asserts the gallery room has no ceiling mesh
- [x] Remove the ceiling geometry/material/mesh from `GalleryRoom`
- [x] Run targeted verification and add a short review summary

Review:

- Removed the ceiling geometry, material, and mesh from `GalleryRoom`, leaving the floor and four walls intact.
- Added a focused `GalleryRoom` regression test that fails if a sixth mesh reintroduces the top wall, and made it resilient to the shared-process module mocks used by `gallery-scene.test.tsx`.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/components/gallery-room.test.tsx tests/unit/components/gallery-scene.test.tsx`, `bunx eslint src/components/gallery/gallery-room.tsx tests/unit/components/gallery-room.test.tsx`, `bunx oxfmt --check src/components/gallery/gallery-room.tsx tests/unit/components/gallery-room.test.tsx`

Refactor pass:

- [x] Extract gallery orbit bounds logic into a pure helper module
- [x] Keep gallery scene focused on wiring and side effects only
- [x] Add focused helper unit tests and rerun existing gallery/latest-painting regressions

Review:

- Moved the camera bounds snapshot/restore/validation logic into `src/lib/pure/gallery-orbit-bounds.ts`, which removes the ad-hoc math from `GalleryScene` and makes the bounds behavior testable without R3F mocks.
- Added `tests/unit/lib/pure/gallery-orbit-bounds.test.ts` to lock down the floor, back-wall, behind-target, and snapshot-restore cases directly at the pure-function layer.
- Verification: `bun test --env-file=.example.vars --preload=./tests/preload.ts tests/unit/lib/pure/gallery-orbit-bounds.test.ts tests/unit/components/gallery-scene.test.tsx tests/unit/hooks/use-latest-painting.test.ts`, `bunx eslint src/lib/pure/gallery-orbit-bounds.ts src/components/gallery/gallery-scene.tsx src/hooks/use-latest-painting.ts src/components/ui/header-progress.tsx`, `bunx oxfmt --check src/lib/pure/gallery-orbit-bounds.ts tests/unit/lib/pure/gallery-orbit-bounds.test.ts src/components/gallery/gallery-scene.tsx src/hooks/use-latest-painting.ts src/components/ui/header-progress.tsx`
