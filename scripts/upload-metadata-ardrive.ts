#!/usr/bin/env bun

/**
 * ArDrive Asset Upload Script
 *
 * Uploads explicit assets or a locally composed fixture bundle to Arweave.
 *
 * Usage:
 *   bun run --env-file=.dev.vars scripts/upload-metadata-ardrive.ts \
 *     --token-id <n> \
 *     --thumbnail <path|url> \
 *     --glb <path|url> \
 *     [--painting-id <id>] \
 *     [--gateway <url>] \
 *     [--dry-run]
 *
 * Fixture mode:
 *   bun run --env-file=.dev.vars scripts/upload-metadata-ardrive.ts \
 *     --token-id <n> \
 *     --fixture \
 *     [--painting-id <id>] \
 *     [--gateway <url>] \
 *     [--dry-run]
 */

import { env } from "@/env";
import { createArdriveClient } from "@/lib/ardrive-client";
import {
  inferContentTypeFromPath,
  loadAssetFromPathOrUrl,
  loadPublicAsset,
} from "@/server/services/paintings/asset-loader";
import type { LoadedAsset } from "@/server/services/paintings/asset-loader";
import {
  buildBaseMetadataUrl,
  buildGatewayBaseUrls,
  buildManifestJson,
  buildMetadataJson,
  buildPreferredAssetUrl,
  buildTokenMetadataUrl,
  buildTransactionUrl,
  ensureTurboUploadFunding,
  normalizeGatewayBaseUrl,
  parseOptionalBigInt,
  resolveTokenMetadataGateway,
  uploadNftMetadataBundle,
  uploadPaintingAssetBundle,
} from "@/server/services/paintings/arweave-services";
import {
  buildFramedPaintingGlbFromPublicFrame,
  copyBytesToArrayBuffer,
} from "@/server/services/paintings/framed-painting-bundle-service";
import { storePaintingAssets } from "@/server/services/paintings/storage";

export {
  buildBaseMetadataUrl,
  buildGatewayBaseUrls,
  buildManifestJson,
  buildMetadataJson,
  buildPreferredAssetUrl,
  buildTokenMetadataUrl,
  buildTransactionUrl,
  ensureTurboUploadFunding,
  inferContentTypeFromPath,
  normalizeGatewayBaseUrl,
  parseOptionalBigInt,
  resolveTokenMetadataGateway,
};

export interface CliArgs {
  dryRun: boolean;
  fixture: boolean;
  gateway?: string;
  glb?: string;
  paintingId?: string;
  thumbnail?: string;
  tokenId: number;
}

interface UploadedAssetBundleSummary {
  baseMetadataUrl: string;
  glbUrl: string;
  imageUrl: string;
  manifestTxId: string;
  metadataTxId: string;
  tokenMetadataUrl: string;
}

const JSON_ENCODER = new TextEncoder();

function printUsage(): void {
  console.log(`
ArDrive Asset Upload Script

Explicit assets:
  --token-id <n>          Token ID / number (required)
  --thumbnail <path|url>  Thumbnail image path or URL (required unless --fixture)
  --glb <path|url>        GLB file path or URL (required unless --fixture)
  --painting-id <id>      Optional Painting-Id tag
  --gateway <url>         Optional gateway override
  --dry-run               Print manifest/metadata preview only

Fixture mode:
  --fixture               Use public/placeholder-painting.webp + public/frame.glb composition
  `);
}

export function parseArgs(args: string[] = process.argv.slice(2)): CliArgs {
  let tokenId: number | undefined;
  let thumbnail: string | undefined;
  let glb: string | undefined;
  let gateway: string | undefined;
  let paintingId: string | undefined;
  let dryRun = false;
  let fixture = false;

  for (let index = 0; index < args.length; index++) {
    switch (args[index]) {
      case "--token-id":
        tokenId = Number(args[++index]);
        break;
      case "--thumbnail":
        thumbnail = args[++index];
        break;
      case "--glb":
        glb = args[++index];
        break;
      case "--gateway":
        gateway = args[++index];
        break;
      case "--painting-id":
        paintingId = args[++index];
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--fixture":
        fixture = true;
        break;
      case "--help":
        printUsage();
        process.exit(0);
    }
  }

  if (!tokenId || Number.isNaN(tokenId)) {
    throw new Error("Error: --token-id <n> is required");
  }

  if (!fixture && !thumbnail) {
    throw new Error("Error: --thumbnail <path|url> is required");
  }

  if (!fixture && !glb) {
    throw new Error("Error: --glb <path|url> is required");
  }

  return {
    dryRun,
    fixture,
    gateway,
    glb,
    paintingId,
    thumbnail,
    tokenId,
  };
}

async function loadFixtureAssets(): Promise<LoadedAsset[]> {
  const imageResult = await loadPublicAsset({ path: "/placeholder-painting.webp" });
  if (imageResult.isErr()) {
    throw new Error(imageResult.error.message);
  }

  const composedGlbResult = await buildFramedPaintingGlbFromPublicFrame({
    paintingImageBuffer: copyBytesToArrayBuffer(imageResult.value.bytes),
    paintingImageContentType: imageResult.value.contentType,
  });
  if (composedGlbResult.isErr()) {
    throw new Error(composedGlbResult.error.message);
  }

  return [
    imageResult.value,
    {
      bytes: new Uint8Array(composedGlbResult.value),
      contentType: "model/gltf-binary",
      source: "worker-compatible-direct-composition",
    },
  ];
}

async function loadExplicitAssets(args: CliArgs): Promise<LoadedAsset[]> {
  if (!args.thumbnail || !args.glb) {
    throw new Error("Explicit asset mode requires both thumbnail and glb inputs");
  }

  const thumbnail = await loadAssetFromPathOrUrl(args.thumbnail, inferContentTypeFromPath(args.thumbnail));
  if (thumbnail.isErr()) {
    throw new Error(thumbnail.error.message);
  }

  const glb = await loadAssetFromPathOrUrl(args.glb, "model/gltf-binary");
  if (glb.isErr()) {
    throw new Error(glb.error.message);
  }

  return [thumbnail.value, glb.value];
}

function buildDryRunSummary(args: CliArgs, explicitGatewayBaseUrl?: string): UploadedAssetBundleSummary {
  const imageUrl = buildTransactionUrl({
    gatewayBaseUrl: explicitGatewayBaseUrl,
    txId: "<image-tx-id>",
  });
  const glbUrl = buildTransactionUrl({
    gatewayBaseUrl: explicitGatewayBaseUrl,
    txId: "<glb-tx-id>",
  });

  return {
    baseMetadataUrl: buildBaseMetadataUrl({
      gatewayBaseUrl: explicitGatewayBaseUrl,
      manifestId: "<manifest-tx-id>",
    }),
    glbUrl,
    imageUrl,
    manifestTxId: "<manifest-tx-id>",
    metadataTxId: "<metadata-tx-id>",
    tokenMetadataUrl: buildTokenMetadataUrl({
      gatewayBaseUrl: explicitGatewayBaseUrl,
      manifestId: "<manifest-tx-id>",
      tokenId: args.tokenId,
    }),
  };
}

function printDryRun(args: CliArgs, assets: LoadedAsset[], explicitGatewayBaseUrl?: string): void {
  const [thumbnail, glb] = assets;
  const preview = buildDryRunSummary(args, explicitGatewayBaseUrl);

  console.log("Dry run only. No upload was performed.");
  console.log("");
  console.log(`Mode: ${args.fixture ? "fixture" : "explicit-assets"}`);
  console.log(`Thumbnail source: ${thumbnail.source}`);
  console.log(`Thumbnail bytes: ${String(thumbnail.bytes.byteLength)}`);
  console.log(`GLB source: ${glb.source}`);
  console.log(`GLB bytes: ${String(glb.bytes.byteLength)}`);
  console.log(`Gateway candidates: ${buildGatewayBaseUrls({ explicitGatewayBaseUrl }).join(", ")}`);
  console.log("");
  console.log("--- metadata.json ---");
  console.log(
    JSON.stringify(
      buildMetadataJson({
        animationUrl: preview.glbUrl,
        imageContentType: thumbnail.contentType,
        imageUrl: preview.imageUrl,
        paintingId: args.paintingId,
        tokenId: args.tokenId,
      }),
      null,
      2,
    ),
  );
  console.log("");
  console.log("--- path-manifest.json ---");
  console.log(
    JSON.stringify(
      buildManifestJson({
        metadataId: preview.metadataTxId,
        tokenId: args.tokenId,
      }),
      null,
      2,
    ),
  );
  console.log("");
  console.log(`Base URL: ${preview.baseMetadataUrl}`);
  console.log(`Token URL: ${preview.tokenMetadataUrl}`);
}

async function uploadExplicitAssets(
  args: CliArgs,
  explicitGatewayBaseUrl: string | undefined,
): Promise<{
  glbUrl: string;
  imageContentType: string;
  imageUrl: string;
}> {
  const [thumbnail, glb] = await loadExplicitAssets(args);
  const ardrive = createArdriveClient({
    secretKey: env.ARDRIVE_TURBO_SECRET_KEY,
  });

  const fundingResult = await ensureTurboUploadFunding({
    ardrive,
    autoTopUpAmountWinston: parseOptionalBigInt(
      env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
      "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
    ),
    byteCounts: [thumbnail.bytes.byteLength, glb.bytes.byteLength],
    notifyThresholdWinc: parseOptionalBigInt(
      env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
      "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
    ),
  });
  if (fundingResult.isErr()) {
    throw new Error(fundingResult.error.message);
  }

  const uploadResult = await uploadPaintingAssetBundle({
    ardrive,
    explicitGatewayBaseUrl,
    image: {
      bytes: thumbnail.bytes,
      contentType: thumbnail.contentType,
    },
    glb: {
      bytes: glb.bytes,
      contentType: glb.contentType,
    },
    paintingId: args.paintingId,
  });
  if (uploadResult.isErr()) {
    throw new Error(uploadResult.error.message);
  }

  return {
    glbUrl: uploadResult.value.glbUrl,
    imageContentType: thumbnail.contentType,
    imageUrl: uploadResult.value.imageUrl,
  };
}

async function uploadFixtureAssets(
  args: CliArgs,
  explicitGatewayBaseUrl: string | undefined,
): Promise<{
  glbUrl: string;
  imageContentType: string;
  imageUrl: string;
}> {
  const imageResult = await loadPublicAsset({ path: "/placeholder-painting.webp" });
  if (imageResult.isErr()) {
    throw new Error(imageResult.error.message);
  }

  const uploadResult = await storePaintingAssets({
    explicitGatewayBaseUrl,
    imageBuffer: copyBytesToArrayBuffer(imageResult.value.bytes),
    imageContentType: imageResult.value.contentType,
    paintingId: args.paintingId ?? `fixture-${String(args.tokenId)}`,
  });
  if (uploadResult.isErr()) {
    throw new Error(uploadResult.error.message);
  }

  return {
    glbUrl: uploadResult.value.glbUrl,
    imageContentType: imageResult.value.contentType,
    imageUrl: uploadResult.value.imageUrl,
  };
}

async function uploadBundle(args: CliArgs): Promise<UploadedAssetBundleSummary> {
  const explicitGatewayBaseUrl = args.gateway ?? env.ARWEAVE_GATEWAY_BASE_URL;

  const assetUploadResult = args.fixture
    ? await uploadFixtureAssets(args, explicitGatewayBaseUrl)
    : await uploadExplicitAssets(args, explicitGatewayBaseUrl);

  const ardrive = createArdriveClient({
    secretKey: env.ARDRIVE_TURBO_SECRET_KEY,
  });

  const metadataPreviewBytes = JSON_ENCODER.encode(
    JSON.stringify(
      buildMetadataJson({
        animationUrl: assetUploadResult.glbUrl,
        imageContentType: assetUploadResult.imageContentType,
        imageUrl: assetUploadResult.imageUrl,
        paintingId: args.paintingId,
        tokenId: args.tokenId,
      }),
    ),
  );
  const manifestPreviewBytes = JSON_ENCODER.encode(
    JSON.stringify(
      buildManifestJson({
        metadataId: "<metadata-tx-id>",
        tokenId: args.tokenId,
      }),
    ),
  );

  const fundingResult = await ensureTurboUploadFunding({
    ardrive,
    autoTopUpAmountWinston: parseOptionalBigInt(
      env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
      "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
    ),
    byteCounts: [metadataPreviewBytes.byteLength, manifestPreviewBytes.byteLength],
    notifyThresholdWinc: parseOptionalBigInt(
      env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
      "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
    ),
  });
  if (fundingResult.isErr()) {
    throw new Error(fundingResult.error.message);
  }

  const metadataUploadResult = await uploadNftMetadataBundle({
    ardrive,
    explicitGatewayBaseUrl,
    fetchImpl: fetch,
    glbUrl: assetUploadResult.glbUrl,
    imageContentType: assetUploadResult.imageContentType,
    imageUrl: assetUploadResult.imageUrl,
    paintingId: args.paintingId,
    tokenId: args.tokenId,
  });
  if (metadataUploadResult.isErr()) {
    throw new Error(metadataUploadResult.error.message);
  }

  return {
    baseMetadataUrl: metadataUploadResult.value.baseMetadataUrl,
    glbUrl: assetUploadResult.glbUrl,
    imageUrl: assetUploadResult.imageUrl,
    manifestTxId: metadataUploadResult.value.manifestTxId,
    metadataTxId: metadataUploadResult.value.metadataTxId,
    tokenMetadataUrl: metadataUploadResult.value.tokenMetadataUrl,
  };
}

const BENCHMARK_GATEWAYS = [
  { label: "permagate.io", url: "https://permagate.io" },
  { label: "arweave.net (US/AWS)", url: "https://arweave.net" },
  { label: "ar-node.megastake.org (VN)", url: "https://ar-node.megastake.org" },
  { label: "deknow.top (CA/Cloudflare)", url: "https://deknow.top" },
] as const;

const BENCHMARK_POLL_INTERVAL_MS = 3_000;
const BENCHMARK_TIMEOUT_MS = 600_000;

function extractTxIdFromUrl(arweaveUrl: string): string {
  return new URL(arweaveUrl).pathname.replace(/^\/+/u, "").split("/")[0];
}

interface GatewayBenchmarkResult {
  elapsedMs: number | null;
  gateway: string;
  httpStatus: number | null;
  label: string;
}

async function pollGateway(params: {
  gatewayUrl: string;
  label: string;
  startTime: number;
  txId: string;
}): Promise<GatewayBenchmarkResult> {
  const url = `${params.gatewayUrl}/${params.txId}`;
  const deadline = params.startTime + BENCHMARK_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(10_000) });
      if (response.ok) {
        const elapsed = Date.now() - params.startTime;
        return { elapsedMs: elapsed, gateway: params.gatewayUrl, httpStatus: response.status, label: params.label };
      }
    } catch {
      // network error or timeout — retry
    }
    await Bun.sleep(BENCHMARK_POLL_INTERVAL_MS);
  }

  return { elapsedMs: null, gateway: params.gatewayUrl, httpStatus: null, label: params.label };
}

async function benchmarkGatewayPropagation(txId: string): Promise<void> {
  console.log("");
  console.log("=== Gateway Propagation Benchmark ===");
  console.log(`TX: ${txId}`);
  console.log(
    `Polling interval: ${String(BENCHMARK_POLL_INTERVAL_MS / 1000)}s | Timeout: ${String(BENCHMARK_TIMEOUT_MS / 60_000)}min`,
  );
  console.log("Waiting for gateways...\n");

  const startTime = Date.now();
  const results = await Promise.all(
    BENCHMARK_GATEWAYS.map(async (gw) => pollGateway({ gatewayUrl: gw.url, label: gw.label, startTime, txId })),
  );

  const sorted = [...results].sort(
    (a, b) => (a.elapsedMs ?? Number.POSITIVE_INFINITY) - (b.elapsedMs ?? Number.POSITIVE_INFINITY),
  );

  console.log("--- Results (sorted by speed) ---");
  console.log("");

  const labelWidth = Math.max(...sorted.map((r) => r.label.length));
  for (const [rank, r] of sorted.entries()) {
    const label = r.label.padEnd(labelWidth);
    const time = r.elapsedMs !== null ? `${(r.elapsedMs / 1000).toFixed(1)}s` : "TIMEOUT";
    const medal = rank === 0 && r.elapsedMs !== null ? " ★" : "";
    console.log(`  ${String(rank + 1)}. ${label}  ${time}${medal}`);
  }

  console.log("");
}

async function main(): Promise<void> {
  const args = parseArgs();
  const explicitGatewayBaseUrl = args.gateway ?? env.ARWEAVE_GATEWAY_BASE_URL;
  const normalizedGateway = explicitGatewayBaseUrl ? normalizeGatewayBaseUrl(explicitGatewayBaseUrl) : undefined;
  const assets = args.fixture ? await loadFixtureAssets() : await loadExplicitAssets(args);

  if (args.dryRun) {
    printDryRun(args, assets, normalizedGateway);
    return;
  }

  const result = await uploadBundle(args);
  console.log("Arweave upload complete.");
  console.log(`Image URL: ${result.imageUrl}`);
  console.log(`GLB URL: ${result.glbUrl}`);
  console.log(`Metadata TX: ${result.metadataTxId}`);
  console.log(`Manifest TX: ${result.manifestTxId}`);
  console.log(`Base metadata URL: ${result.baseMetadataUrl}`);
  console.log(`Token metadata URL: ${result.tokenMetadataUrl}`);

  const imageTxId = extractTxIdFromUrl(result.imageUrl);
  await benchmarkGatewayPropagation(imageTxId);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
