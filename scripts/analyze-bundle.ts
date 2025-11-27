import fs from "fs";

const metaPath = ".open-next/server-functions/default/handler.mjs.meta.json";
const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));

const inputs = meta.inputs;
const entries = Object.entries(inputs).map(([path, data]: [string, any]) => ({
  path,
  bytes: data.bytes,
}));

entries.sort((a, b) => b.bytes - a.bytes);

console.log("Top 20 largest files in bundle:");
entries.slice(0, 20).forEach(entry => {
  console.log(`${(entry.bytes / 1024).toFixed(2)} KB - ${entry.path}`);
});
