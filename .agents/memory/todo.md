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
