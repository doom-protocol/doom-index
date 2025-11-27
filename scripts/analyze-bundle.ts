import fs from "fs";

interface OpenNextMetaInput {
  bytes: number;
}

interface OpenNextMeta {
  inputs: Record<string, OpenNextMetaInput>;
}

const metaPath = ".open-next/server-functions/default/handler.mjs.meta.json";
const meta: OpenNextMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

const entries = Object.entries(meta.inputs).map(([path, data]: [string, OpenNextMetaInput]) => ({
  path,
  bytes: data.bytes,
}));

entries.sort((a, b) => b.bytes - a.bytes);

console.log("Top 20 largest files in bundle:");
entries.slice(0, 20).forEach(entry => {
  console.log(`${(entry.bytes / 1024).toFixed(2)} KB - ${entry.path}`);
});
