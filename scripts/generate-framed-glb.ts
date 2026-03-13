#!/usr/bin/env bun

import {
  inferContentTypeFromPath,
  loadAssetFromPathOrUrl,
  loadPublicAsset,
} from "@/server/services/paintings/asset-loader";
import {
  buildFramedPaintingGlbFromPublicFrame,
  copyBytesToArrayBuffer,
} from "@/server/services/paintings/framed-painting-bundle-service";
import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

interface GenerateFramedGlbArgs {
  image: string;
  output: string;
}

function readRequiredFlagValue(args: string[], index: number, flag: "--image" | "--out"): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    printUsage();
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function printUsage(): void {
  console.log(`
Generate the Worker-safe framed painting GLB used by the Arweave asset pipeline.

Usage:
  bun scripts/generate-framed-glb.ts [options]

Options:
  --image <path|url>      Painting image input (default: /placeholder-painting.webp)
  --out <path>            Output GLB path (default: out/framed-painting.glb)
  --help                  Show this help
  `);
}

export function buildFixtureArgs(): GenerateFramedGlbArgs {
  return {
    image: "/placeholder-painting.webp",
    output: "out/framed-painting.glb",
  };
}

export function parseArgs(args: string[] = process.argv.slice(2)): GenerateFramedGlbArgs {
  const parsed = buildFixtureArgs();

  for (let index = 0; index < args.length; index++) {
    switch (args[index]) {
      case "--image":
        parsed.image = readRequiredFlagValue(args, index, "--image");
        index += 1;
        break;
      case "--out":
        parsed.output = readRequiredFlagValue(args, index, "--out");
        index += 1;
        break;
      case "--help":
        printUsage();
        process.exit(0);
    }
  }

  return parsed;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function loadInputAsset(pathOrUrl: string) {
  if (pathOrUrl.startsWith("/") && !(await pathExists(pathOrUrl))) {
    const asset = await loadPublicAsset({ path: pathOrUrl as `/${string}` });
    if (asset.isErr()) {
      throw new Error(asset.error.message);
    }

    return asset.value;
  }

  const asset = await loadAssetFromPathOrUrl(pathOrUrl, inferContentTypeFromPath(pathOrUrl));
  if (asset.isErr()) {
    throw new Error(asset.error.message);
  }

  return asset.value;
}

export async function generateFramedGlb(args: GenerateFramedGlbArgs): Promise<{
  bytes: ArrayBuffer;
  imageSource: string;
  output: string;
  pipeline: string;
}> {
  const imageAsset = await loadInputAsset(args.image);
  const exportResult = await buildFramedPaintingGlbFromPublicFrame({
    paintingImageBuffer: copyBytesToArrayBuffer(imageAsset.bytes),
    paintingImageContentType: imageAsset.contentType,
  });
  if (exportResult.isErr()) {
    throw new Error(exportResult.error.message);
  }

  await mkdir(dirname(args.output), { recursive: true });
  await Bun.write(args.output, exportResult.value);

  return {
    bytes: exportResult.value,
    imageSource: imageAsset.source,
    output: args.output,
    pipeline: "worker-compatible-direct-composition",
  };
}

async function main(): Promise<void> {
  const args = parseArgs();
  const result = await generateFramedGlb(args);

  console.log(`Image source: ${result.imageSource}`);
  console.log(`Pipeline: ${result.pipeline}`);
  console.log(`Output: ${result.output}`);
  console.log(`Bytes: ${String(result.bytes.byteLength)}`);
}

if (import.meta.main) {
  await main();
}
