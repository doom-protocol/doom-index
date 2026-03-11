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
