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

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetFile = path.resolve(__dirname, "..", ".open-next", "server-functions", "default", "handler.mjs");

if (!existsSync(targetFile)) {
  console.warn(`[patch-setimmediate] Skipped: ${targetFile} not found (run build:cf first)`);
  process.exit(0);
}

const original = readFileSync(targetFile, "utf8");

// Check if already patched
if (original.includes("/* CF_PATCHED: setImmediate */")) {
  console.info("[patch-setimmediate] Already applied");
  process.exit(0);
}

// Patch the install() function to wrap assignments in try-catch
// The minified code pattern is:
//   globalThis.setImmediate=nodeTimers.setImmediate=patchedSetImmediate,
//   globalThis.clearImmediate=nodeTimers.clearImmediate=patchedClearImmediate
//   nodeTimersPromises.setImmediate=patchedSetImmediatePromise

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

let updated = original;
let patchesApplied = 0;

for (const [pattern, replacement] of replacements) {
  const before = updated;
  updated = updated.replace(pattern, replacement);
  if (updated !== before) {
    patchesApplied++;
  }
}

if (patchesApplied === 0) {
  console.warn("[patch-setimmediate] No patches applied; source may have different structure or already patched");
  // Show what patterns exist in the file for debugging
  const debugPatterns = [/globalThis\.setImmediate/, /nodeTimers\.setImmediate/, /patchedSetImmediate/];
  for (const p of debugPatterns) {
    const match = original.match(p);
    console.warn(`  Pattern ${p.source}: ${match ? "found" : "not found"}`);
  }
  process.exit(0);
}

writeFileSync(targetFile, updated, "utf8");
console.info(`[patch-setimmediate] Applied ${String(patchesApplied)} patch(es) for Cloudflare Workers compatibility`);
