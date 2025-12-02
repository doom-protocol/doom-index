import fs from "fs";

interface OpenNextMetaInput {
  bytes: number;
}

interface OpenNextMeta {
  inputs: Record<string, OpenNextMetaInput>;
}

interface BundleEntry {
  path: string;
  bytes: number;
  library?: string;
}

function extractLibraryName(path: string): string | undefined {
  // Extract library name from node_modules path
  const nodeModulesMatch = path.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  if (nodeModulesMatch) {
    return nodeModulesMatch[1];
  }

  // Extract library name from project source files
  const srcMatch = path.match(/src\/([^/]+)/);
  if (srcMatch) {
    return `src/${srcMatch[1]}`;
  }

  return undefined;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(2)} KB`;
}

const metaPath = ".open-next/server-functions/default/handler.mjs.meta.json";

if (!fs.existsSync(metaPath)) {
  console.error(`Error: ${metaPath} not found. Please run 'bun run build:cf' first.`);
  process.exit(1);
}

const meta: OpenNextMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

const entries: BundleEntry[] = Object.entries(meta.inputs).map(([path, data]: [string, OpenNextMetaInput]) => ({
  path,
  bytes: data.bytes,
  library: extractLibraryName(path),
}));

// Sort by size
entries.sort((a, b) => b.bytes - a.bytes);

// Group by library
const libraryMap = new Map<string, number>();
entries.forEach(entry => {
  if (entry.library) {
    const current = libraryMap.get(entry.library) || 0;
    libraryMap.set(entry.library, current + entry.bytes);
  }
});

const libraryEntries = Array.from(libraryMap.entries())
  .map(([library, bytes]) => ({ library, bytes }))
  .sort((a, b) => b.bytes - a.bytes);

const totalSize = entries.reduce((sum, entry) => sum + entry.bytes, 0);

console.log("=".repeat(80));
console.log("BUNDLE ANALYSIS REPORT");
console.log("=".repeat(80));
console.log(`Total bundle size: ${formatBytes(totalSize)}\n`);

console.log("=".repeat(80));
console.log("TOP 50 LARGEST FILES");
console.log("=".repeat(80));
entries.slice(0, 50).forEach((entry, index) => {
  const percentage = ((entry.bytes / totalSize) * 100).toFixed(2);
  console.log(`${String(index + 1).padStart(3)}. ${formatBytes(entry.bytes).padEnd(10)} (${percentage.padStart(5)}%) - ${entry.path}`);
});

console.log("\n" + "=".repeat(80));
console.log("TOP 30 LARGEST LIBRARIES/DEPENDENCIES");
console.log("=".repeat(80));
libraryEntries.slice(0, 30).forEach((entry, index) => {
  const percentage = ((entry.bytes / totalSize) * 100).toFixed(2);
  console.log(`${String(index + 1).padStart(3)}. ${formatBytes(entry.bytes).padEnd(10)} (${percentage.padStart(5)}%) - ${entry.library}`);
});

console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
console.log(`Total files: ${entries.length}`);
console.log(`Total libraries: ${libraryEntries.length}`);
console.log(`Average file size: ${formatBytes(totalSize / entries.length)}`);
console.log(`Largest file: ${formatBytes(entries[0]?.bytes || 0)} - ${entries[0]?.path || "N/A"}`);
console.log(`Largest library: ${formatBytes(libraryEntries[0]?.bytes || 0)} - ${libraryEntries[0]?.library || "N/A"}`);
console.log("=".repeat(80));
