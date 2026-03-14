import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import openNextConfig from "../open-next.config";

interface SplitFunctionConfig {
  patterns?: string[] | string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workerFile = path.resolve(__dirname, "..", ".open-next", "worker.js");
const initFile = path.resolve(__dirname, "..", ".open-next", "cloudflare", "init.js");
const serverFunctionsDir = path.resolve(__dirname, "..", ".open-next", "server-functions");

const PATCH_MARKER = "/* CF_PATCHED: split preview */";
const ORIGIN_PATCH_MARKER = "/* CF_PATCHED: split origins */";

const GENERATED_HANDLER_REPLACEMENTS: Array<{ label: string; pattern: RegExp; replacement: string }> = [
  {
    label: "cache handler",
    pattern: /cacheHandlerPath=require\.resolve\("\.\/cache\.cjs"\)/g,
    replacement: `cacheHandlerPath=""`,
  },
  {
    label: "composable cache handler",
    pattern: /composableCacheHandlerPath=require\.resolve\("\.\/composable-cache\.cjs"\)/g,
    replacement: `composableCacheHandlerPath=""`,
  },
];

const functions = Object.entries(
  (openNextConfig as { functions?: Record<string, SplitFunctionConfig> }).functions ?? {},
)
  .filter(([key]) => key !== "default")
  .map(([key, value]) => ({
    key,
    patterns: Array.isArray(value.patterns) ? value.patterns : value.patterns ? [value.patterns] : [],
  }))
  .filter((entry) => entry.patterns.length > 0);

function patchGeneratedHandler(key: string) {
  const handlerFile = path.join(serverFunctionsDir, key, "handler.mjs");

  if (!existsSync(handlerFile)) {
    console.warn(`[patch-splitpreview] Skipped handler patch: ${handlerFile} not found`);
    return;
  }

  const source = readFileSync(handlerFile, "utf8");
  let updated = source;
  const appliedLabels: string[] = [];

  for (const { label, pattern, replacement } of GENERATED_HANDLER_REPLACEMENTS) {
    const next = updated.replace(pattern, replacement);

    if (next !== updated) {
      appliedLabels.push(label);
      updated = next;
    }
  }

  if (updated !== source) {
    writeFileSync(handlerFile, updated, "utf8");
    console.info(`[patch-splitpreview] Patched ${appliedLabels.join(", ")} for ${key}`);
  }
}

if (functions.length === 0) {
  console.info("[patch-splitpreview] Skipped: no split functions configured");
  process.exit(0);
}

for (const { key } of functions) {
  patchGeneratedHandler(key);
}

if (!existsSync(workerFile)) {
  console.warn(`[patch-splitpreview] Skipped: ${workerFile} not found (run build:cf first)`);
  process.exit(0);
}

const workerSource = readFileSync(workerFile, "utf8");

if (workerSource.includes(PATCH_MARKER)) {
  console.info("[patch-splitpreview] Worker already patched");
  const updatedWorker = workerSource.replaceAll("/index.mjs", "/handler.mjs");

  if (updatedWorker !== workerSource) {
    writeFileSync(workerFile, updatedWorker, "utf8");
  }
} else {
  const routeConfigLiteral = JSON.stringify(functions);
  const handlerCases = functions
    .map(
      ({ key }) => `        case ${JSON.stringify(key)}:
            return import(${JSON.stringify(`./server-functions/${key}/handler.mjs`)});`,
    )
    .join("\n");
  const helperCode = [
    `const __OPEN_NEXT_SPLIT_ROUTES__ = ${routeConfigLiteral};`,
    "const __OPEN_NEXT_SPLIT_REGEX_CACHE__ = new Map();",
    "function __openNextPatternToRegex__(pattern) {",
    "    const cached = __OPEN_NEXT_SPLIT_REGEX_CACHE__.get(pattern);",
    "    if (cached) {",
    "        return cached;",
    "    }",
    '    const escaped = pattern.replace(/[.+^${}()|[\\]\\\\]/g, "\\\\$&");',
    '    const regex = new RegExp(`^${escaped.replace(/\\\\\\*\\\\\\*/g, ".*").replace(/\\\\\\*/g, "[^/]*").replace(/\\\\\\?/g, ".")}$`);',
    "    __OPEN_NEXT_SPLIT_REGEX_CACHE__.set(pattern, regex);",
    "    return regex;",
    "}",
    "function __resolveSplitFunctionKey__(pathname) {",
    "    for (const entry of __OPEN_NEXT_SPLIT_ROUTES__) {",
    "        for (const pattern of entry.patterns) {",
    "            if (__openNextPatternToRegex__(pattern).test(pathname)) {",
    "                return entry.key;",
    "            }",
    "        }",
    "    }",
    '    return "default";',
    "}",
    "async function __loadServerHandler__(request) {",
    "    const pathname = new URL(request.url).pathname;",
    "    switch (__resolveSplitFunctionKey__(pathname)) {",
    handlerCases,
    "        default:",
    '            return import("./server-functions/default/handler.mjs");',
    "    }",
    "}",
    PATCH_MARKER,
  ].join("\n");

  const exportMarker = "export default {";
  const dispatchAnchor = `            // @ts-expect-error: resolved by wrangler build
            const { handler } = await import("./server-functions/default/handler.mjs");
            return handler(reqOrResp, env, ctx, request.signal);`;

  if (!workerSource.includes(exportMarker) || !workerSource.includes(dispatchAnchor)) {
    console.warn("[patch-splitpreview] Worker anchors not found; upstream may have changed");
    process.exit(0);
  }

  const updatedWorker = workerSource
    .replace(exportMarker, () => `${helperCode}\n${exportMarker}`)
    .replace(
      dispatchAnchor,
      () => `            const { handler } = await __loadServerHandler__(reqOrResp);
            return handler(reqOrResp, env, ctx, request.signal);`,
    )
    .replaceAll("/index.mjs", "/handler.mjs");

  writeFileSync(workerFile, updatedWorker, "utf8");
  console.info("[patch-splitpreview] Patched worker split dispatch for local preview");
}

if (!existsSync(initFile)) {
  console.warn(`[patch-splitpreview] Skipped init patch: ${initFile} not found`);
  process.exit(0);
}

const initSource = readFileSync(initFile, "utf8");

if (initSource.includes(ORIGIN_PATCH_MARKER)) {
  console.info("[patch-splitpreview] Init already patched");
  process.exit(0);
}

const originEntries = ["default", ...functions.map(({ key }) => key)]
  .map(
    (key) => `    ${JSON.stringify(key)}: {
      host: url.hostname,
      protocol: url.protocol.slice(0, -1),
      port: url.port
    },`,
  )
  .join("\n");

const originAnchor = `  process.env.OPEN_NEXT_ORIGIN = JSON.stringify({
    default: {
      host: url.hostname,
      protocol: url.protocol.slice(0, -1),
      port: url.port
    }
  });`;

if (!initSource.includes(originAnchor)) {
  console.warn("[patch-splitpreview] Init origin anchor not found; upstream may have changed");
  process.exit(0);
}

const updatedInit = initSource.replace(
  originAnchor,
  `  process.env.OPEN_NEXT_ORIGIN = JSON.stringify({
${originEntries}
  });
  ${ORIGIN_PATCH_MARKER}`,
);

writeFileSync(initFile, updatedInit, "utf8");
console.info("[patch-splitpreview] Patched split origins for local preview");
