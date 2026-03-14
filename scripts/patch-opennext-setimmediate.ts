/**
 * Patch for Next.js fast-set-immediate compatibility with Cloudflare Workers
 *
 * Next.js 16+ introduces a fast-set-immediate patch that tries to reassign
 * `node:timers.setImmediate`, but in Cloudflare Workers with nodejs_compat,
 * the module exports are read-only, causing:
 *   TypeError: Cannot assign to read only property 'setImmediate' of object '[object Module]'
 *
 * This patch wraps the problematic assignments in try-catch blocks.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serverFunctionsDir = path.resolve(__dirname, "..", ".open-next", "server-functions");

if (!existsSync(serverFunctionsDir)) {
  console.warn(`[patch-setimmediate] Skipped: ${serverFunctionsDir} not found (run build:cf first)`);
  process.exit(0);
}

const replacements: Array<[RegExp, string]> = [
  // Match minified setImmediate assignment chain (comma-separated statements)
  [
    /globalThis\.setImmediate=nodeTimers\.setImmediate=patchedSetImmediate,/g,
    `/* CF_PATCHED: setImmediate */ (()=>{try{globalThis.setImmediate=patchedSetImmediate}catch{}try{nodeTimers.setImmediate=patchedSetImmediate}catch{}})(),`,
  ],
  // Match minified clearImmediate assignment chain
  [
    /globalThis\.clearImmediate=nodeTimers\.clearImmediate=patchedClearImmediate/g,
    `/* CF_PATCHED: clearImmediate */ (()=>{try{globalThis.clearImmediate=patchedClearImmediate}catch{}try{nodeTimers.clearImmediate=patchedClearImmediate}catch{}})()`,
  ],
  // Match minified setImmediatePromise assignment
  [
    /nodeTimersPromises\.setImmediate=patchedSetImmediatePromise/g,
    `/* CF_PATCHED: setImmediatePromise */ (()=>{try{nodeTimersPromises.setImmediate=patchedSetImmediatePromise}catch{}})()`,
  ],
  // Also handle semicolon-separated versions (in case formatting differs)
  [
    /globalThis\.setImmediate=nodeTimers\.setImmediate=patchedSetImmediate;/g,
    `/* CF_PATCHED: setImmediate */ (()=>{try{globalThis.setImmediate=patchedSetImmediate}catch{}try{nodeTimers.setImmediate=patchedSetImmediate}catch{}})();`,
  ],
  [
    /globalThis\.clearImmediate=nodeTimers\.clearImmediate=patchedClearImmediate;/g,
    `/* CF_PATCHED: clearImmediate */ (()=>{try{globalThis.clearImmediate=patchedClearImmediate}catch{}try{nodeTimers.clearImmediate=patchedClearImmediate}catch{}})();`,
  ],
  [
    /nodeTimersPromises\.setImmediate=patchedSetImmediatePromise;/g,
    `/* CF_PATCHED: setImmediatePromise */ (()=>{try{nodeTimersPromises.setImmediate=patchedSetImmediatePromise}catch{}})();`,
  ],
];

const handlerFiles = readdirSync(serverFunctionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(serverFunctionsDir, entry.name, "handler.mjs"))
  .filter((filePath) => existsSync(filePath));

if (handlerFiles.length === 0) {
  console.warn("[patch-setimmediate] No handler.mjs files found under .open-next/server-functions");
  process.exit(0);
}

let patchedFiles = 0;
let patchedPatterns = 0;

for (const targetFile of handlerFiles) {
  const original = readFileSync(targetFile, "utf8");

  if (original.includes("/* CF_PATCHED: setImmediate */")) {
    continue;
  }

  let updated = original;
  let filePatchesApplied = 0;

  for (const [pattern, replacement] of replacements) {
    const before = updated;
    updated = updated.replace(pattern, replacement);
    if (updated !== before) {
      filePatchesApplied++;
    }
  }

  if (filePatchesApplied === 0) {
    console.warn(`[patch-setimmediate] No patches applied for ${targetFile}`);
    continue;
  }

  writeFileSync(targetFile, updated, "utf8");
  patchedFiles++;
  patchedPatterns += filePatchesApplied;
}

if (patchedFiles === 0) {
  console.info("[patch-setimmediate] No updates needed");
  process.exit(0);
}

console.info(
  `[patch-setimmediate] Applied ${String(patchedPatterns)} patch(es) across ${String(patchedFiles)} handler(s)`,
);
