# Lefthook Introduction

## Docs Reorganization

## Plan

- [x] Audit the current `docs/` and `.kiro/` documentation layout and define a replacement structure under `docs/`
- [x] Move `.kiro/steering/{product,tech,structure}.md` to `docs/{PRODUCT,TECH,STRUCTURE}.md`
- [x] Reorganize existing `docs/*.md` files into topical subdirectories with minimal, clear naming
- [x] Move `.kiro/specs/` to `docs/specs/` and update any repo references that still point to `.kiro/specs`
- [x] Review the final tree and verify there are no stale `.kiro/steering` or `.kiro/specs` references

## Review

- Added `docs/README.md` as the entry point for the reorganized documentation tree.
- Moved Kiro steering docs to `docs/PRODUCT.md`, `docs/TECH.md`, and `docs/STRUCTURE.md`.
- Grouped existing docs into `architecture/`, `guides/`, `reference/`, `analysis/`, and `legacy/`.
- Moved all feature specs from `.kiro/specs/` to `docs/specs/`.
- Updated `README.md`, docs cross-links, spec references, and the world prompt service doc comment to the new paths.
- Verified there are no remaining references to `.kiro/steering`, `.kiro/specs`, or the old flat `docs/*.md` paths that were moved.

---

# Quality Cache And Runner Update

## Plan

- [x] Confirm which quality commands support native cache and avoid inventing one for `oxfmt`
- [x] Update local scripts so `lint` and `typecheck` reuse repo-local cache artifacts
- [x] Update GitHub Actions to restore/save tool caches, keep `node_modules` cached, and switch every workflow runner to `blacksmith-4vcpu-ubuntu-2404`
- [x] Run `format`, `lint`, and `typecheck` to verify the new setup and record the outcome

## Review

- Left `format` unchanged because `oxfmt --help` exposes no native cache support, so no custom cache layer was added.
- Updated local scripts so `bun run lint` uses ESLint content-cache at `.cache/eslint/.eslintcache`, and `bun run typecheck` writes incremental state to `.cache/tsgo/typecheck.tsbuildinfo`.
- Updated GitHub Actions so all workflows now use `runs-on: blacksmith-4vcpu-ubuntu-2404`.
- Kept GitHub Actions dependency caching for `node_modules` in CI and added the same Bun dependency cache to `bundle-analyzer.yml`.
- Added GitHub Actions cache restore/save steps for `.cache/eslint` and `.cache/tsgo` in the `lint` and `typecheck` jobs.
- Verification: `.cache/eslint/.eslintcache` and `.cache/tsgo/typecheck.tsbuildinfo` were generated locally.
- Verification: `bun run format` still fails on pre-existing formatting issues in `src/utils/hash.ts`, `tests/integration/app/opengraph-image.integration.test.tsx`, and `tests/unit/utils/image.test.ts`.
- Verification: `bun run lint` still fails on pre-existing repository issues (`77 errors`, `92 warnings` in the current run).
- Verification: `bun run typecheck` still fails on the existing `ArrayBuffer | SharedArrayBuffer` mismatch in `src/utils/image.ts:11`.

---

## Plan

- [x] Confirm the current package manager, scripts, and CI quality gates
- [x] Add `lefthook` with a minimal hook configuration aligned to existing lint/format/typecheck commands
- [x] Verify hook installation and command execution locally

---

# ESLint Config Update

## Plan

- [x] Review the current ESLint setup and capture the user correction about not disabling rules
- [x] Replace `eslint.config.ts` with the requested shared-config structure
- [x] Run `bun run lint:fix` and use targeted code changes for remaining violations
- [x] Re-run `bun run lint` and `bun run typecheck`

## Review

- Replaced `eslint.config.ts` with the requested `@posaune0423/eslint-config` + `@next/eslint-plugin-next` structure and kept the existing `page.tsx` numeric-literal rule.
- Fixed the repository against the stricter shared config instead of disabling rules: tightened runtime type guards, removed unnecessary conditionals, cleaned Promise/event-handler usage, updated test mocks, and replaced deprecated or warning-prone helper patterns where practical.
- Verification passed: `bun run format`, `bun run lint`, and `bun run typecheck` now all succeed.
- Lint was driven from roughly `375 errors / 96 warnings` down to `0 errors / 0 warnings`.

---

# Knip Noise Reduction

## Plan

- [x] Inspect the current `knip` findings and separate false positives from likely real cleanup items
- [x] Tighten `knip.json` so non-project directories are out of scope and non-imported runtime/script entrypoints are declared explicitly
- [x] Re-run `knip` and confirm only the intended findings disappeared

## Review

- Narrowed `knip` project scope to repository source, tests, scripts, and root config files so agent metadata/tooling directories no longer appear as `Unused files`.
- Declared string-referenced or manually executed files as `entry` items: `open-next.config.ts`, several standalone scripts, `scripts/webpack/stub.cjs`, and `src/lib/image-loader.ts`.
- Ignored the intentionally retained legacy whitepaper asset `src/assets/whitepaper/v1.mdx`.
- Verified `bun run knip` no longer reports `Unused files` or configuration hints; remaining findings are dependencies, unresolved imports, and unused exports that should still be reviewed rather than suppressed.
- Verified dependency findings more narrowly:
- `tailwindcss` is a false positive from `src/app/globals.css` `@import "tailwindcss"` and is now ignored in `knip`.
- `postcss` is a false positive for `postcss.config.mjs` because `@tailwindcss/postcss` brings `postcss` transitively and this repo does not import it directly.
- `bun-types` resolves correctly in TypeScript tracing but is still reported by `knip`, so it is ignored as an unresolved-import false positive.
- `mdx/types` resolves to `node_modules/@types/mdx/types.d.ts`; this should remain actionable rather than ignored because the repo imports it directly without declaring `@types/mdx`.
- `eslint-plugin-react-you-might-not-need-an-effect` and `eslint-plugin-unicorn` are bundled inside `@posaune0423/eslint-config`, so their current root entries look removable rather than ignorable.
- `eslint-plugin-react-compiler`, `eslint-plugin-tailwindcss`, `eslint-plugin-unused-imports`, `eslint-config-next`, `@trpc/next`, `zustand`, `@metaplex-foundation/umi-uploader-irys`, and `@metaplex-foundation/umi-web3js-adapters` still appear unused from current source/config inspection.

## Review

- Added `lefthook` as a dev dependency and committed a root `lefthook.yml`.
- `pre-commit` now calls the existing `bun run format` and `bun run lint` scripts.
- `pre-push` now calls the existing `bun run typecheck` script.
- `bunx lefthook validate` passed and `bunx lefthook dump` matches the expected commands.
- `bunx lefthook run pre-push --force` passed.
- `bunx lefthook run pre-commit --force` was blocked by the current dirty worktree: `git stash create` fails on `.claude/commands/bug-fix.md` because it is beyond a symbolic link.
- Independent of this task, `bun run format` and `bun run lint` already fail on the current branch due pre-existing formatting and lint debt.
