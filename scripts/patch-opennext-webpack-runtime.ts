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
  "patches",
  "ast",
  "webpack-runtime.js",
);

if (!existsSync(targetFile)) {
  console.warn(`[patch-opennext] Skipped: ${targetFile} not found`);
  process.exit(0);
}

const original = readFileSync(targetFile, "utf8");

if (original.includes("switch (String($CHUNK_ID))")) {
  console.info("[patch-opennext] Already applied");
  process.exit(0);
}

const replacements: Array<[string, string]> = [
  ["switch ($CHUNK_ID)", "switch (String($CHUNK_ID))"],
  [
    "case $SELF_ID: $INSTALLED_CHUNK[$CHUNK_ID] = 1; break;",
    'case "$SELF_ID": $INSTALLED_CHUNK[$CHUNK_ID] = 1; break;',
  ],
  [
    'case ${chunk}: $INSTALL(require("./chunks/${chunk}.js")); break;',
    'case "${chunk}": $INSTALL(require("./chunks/${chunk}.js")); break;',
  ],
  ['return Number(chunk.replace(/\\.js$/, ""));', 'return chunk.replace(/\\.js$/, "");'],
];

let updated = original;

for (const [from, to] of replacements) {
  if (!updated.includes(from)) {
    continue;
  }
  updated = updated.replace(from, to);
}

if (updated === original) {
  console.warn("[patch-opennext] No changes were applied; source may have changed upstream");
  process.exit(0);
}

writeFileSync(targetFile, updated, "utf8");
console.info("[patch-opennext] Applied webpack runtime chunk patch");
