import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "@opennextjs",
  "cloudflare",
  "dist",
  "cli",
  "build",
  "bundle-server.js",
);

if (!existsSync(targetFile)) {
  console.warn(`[patch-bundle-server] Skipped: ${targetFile} not found`);
  process.exit(0);
}

const original = readFileSync(targetFile, "utf8");

const PATCH_MARKER = "/* DOOM_WORKER_STUBS */";

if (original.includes(PATCH_MARKER)) {
  console.info("[patch-bundle-server] Already applied");
  process.exit(0);
}

const stubbedModules = [
  "three",
  "three-stdlib",
  "@react-three/fiber",
  "@react-three/drei",
  "leva",
  "sonner",
  "use-sound",
  "use-haptic",
  "@solana/web3.js",
  "@solana/wallet-adapter-base",
  "@solana/wallet-adapter-react",
  "@solana/wallet-adapter-react-ui",
  "@solana/wallet-adapter-wallets",
  "@metaplex-foundation/mpl-token-metadata",
  "@metaplex-foundation/umi",
  "@metaplex-foundation/umi-bundle-defaults",
  "@metaplex-foundation/umi-signer-wallet-adapters",
];

const stubAliasLines = stubbedModules
  .map((mod) => `            "${mod}": path.resolve(process.cwd(), "scripts/webpack/stub.cjs"),`)
  .join("\n");

const injection = `\n            ${PATCH_MARKER}\n${stubAliasLines}`;

const anchorPattern = `"@next/env": path.join(buildOpts.outputDir, "cloudflare-templates/shims/env.js"),`;

if (!original.includes(anchorPattern)) {
  console.warn("[patch-bundle-server] Anchor pattern not found; upstream may have changed");
  process.exit(0);
}

const updated = original.replace(anchorPattern, `${anchorPattern}${injection}`);

if (updated === original) {
  console.warn("[patch-bundle-server] No changes applied");
  process.exit(0);
}

writeFileSync(targetFile, updated, "utf8");
console.info("[patch-bundle-server] Applied worker stub aliases for esbuild bundling");
