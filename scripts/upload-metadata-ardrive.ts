#!/usr/bin/env bun

/**
 * ArDrive Asset Upload Script
 *
 * Uploads an explicit thumbnail image and GLB file to Arweave via ArDrive Turbo.
 *
 * Usage:
 *   bun run --env-file=.dev.vars scripts/upload-metadata-ardrive.ts \
 *     --token-id <n>         # Token ID / number (required)
 *     --thumbnail <path|url>  # Thumbnail image path or URL (required)
 *     --glb <path|url>        # GLB file path or URL (required)
 *     [--painting-id <id>]    # Optional Painting-Id tag value
 *     [--gateway <url>]       # Optional gateway override (default: permagate.io)
 *     [--dry-run]             # Print resolved asset info only, skip uploads
 */

import { DEFAULT_ARWEAVE_GATEWAY_BASE_URL } from "@/constants/arweave";
import { createArdriveClient } from "@/lib/ardrive-client";
import type { ArdriveClient, Tag } from "@/lib/ardrive-client";
import { existsSync } from "node:fs";
import { extname } from "node:path";

export interface CliArgs {
  dryRun: boolean;
  gateway?: string;
  glb: string;
  paintingId?: string;
  thumbnail: string;
  tokenId: number;
}

interface LoadedAsset {
  bytes: Uint8Array;
  contentType: string;
  source: string;
}

interface MetadataJson {
  animation_url: string;
  attributes: Array<{
    trait_type: string;
    value: number | string;
  }>;
  description: string;
  external_url: string;
  image: string;
  name: string;
  properties: {
    category: string;
    files: Array<{
      type: string;
      uri: string;
    }>;
  };
  symbol: string;
}

interface ArweavePathManifest {
  manifest: "arweave/paths";
  paths: Record<string, { id: string }>;
  version: "0.2.0";
}

interface TurboFundingNotificationPayload {
  autoTopUpAmountWinston?: bigint;
  currentBalanceWinc: bigint;
  estimatedCostWinc: bigint;
  remainingBalanceWinc: bigint;
}

interface TurboFundingCheckResult {
  currentBalanceWinc: bigint;
  didNotify: boolean;
  didTopUp: boolean;
  estimatedCostWinc: bigint;
  remainingBalanceWinc: bigint;
  topUpTransactionId?: string;
}

const THUMBNAIL_FILE_TYPE = "thumbnail";
const ANIMATION_FILE_TYPE = "animation";
const METADATA_FILE_TYPE = "metadata";
const MANIFEST_FILE_TYPE = "manifest";
const DEFAULT_CONTENT_TYPE = "application/octet-stream";
const MANIFEST_CONTENT_TYPE = "application/x.arweave-manifest+json";
const METADATA_DESCRIPTION =
  "A generative artwork from DOOM INDEX - an AI-powered decentralized archive of financial emotions.";
const JSON_ENCODER = new TextEncoder();
const MANIFEST_VERSION = "0.2.0";
const DEFAULT_GATEWAY_PROBE_TIMEOUT_MS = 1500;
const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  ".glb": "model/gltf-binary",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function parseArgs(args: string[] = process.argv.slice(2)): CliArgs {
  let tokenId: number | undefined;
  let thumbnail: string | undefined;
  let glb: string | undefined;
  let gateway: string | undefined;
  let paintingId: string | undefined;
  let dryRun = false;

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
    }
  }

  if (!tokenId || Number.isNaN(tokenId)) {
    throw new Error("Error: --token-id <n> is required");
  }

  if (!thumbnail) {
    throw new Error("Error: --thumbnail <path|url> is required");
  }

  if (!glb) {
    throw new Error("Error: --glb <path|url> is required");
  }

  return {
    dryRun,
    gateway,
    glb,
    paintingId,
    thumbnail,
    tokenId,
  };
}

export function normalizeGatewayBaseUrl(gatewayBaseUrl: string): string {
  const normalized = gatewayBaseUrl.trim().replace(/\/+$/u, "");

  if (!normalized) {
    throw new Error("Error: --gateway <url> must not be empty");
  }

  return new URL(normalized).toString().replace(/\/+$/u, "");
}

export function parseOptionalBigInt(value: string | undefined, envName: string): bigint | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return BigInt(value);
  } catch {
    throw new Error(`Error: ${envName} must be an integer string`);
  }
}

function appendUrlSegment(baseUrl: string, segment: string): string {
  return `${normalizeGatewayBaseUrl(baseUrl)}/${segment}`;
}

export function buildGatewayBaseUrls(params: { explicitGatewayBaseUrl?: string }): string[] {
  const seen = new Set<string>();
  const gateways: string[] = [];

  const pushGateway = (value: string | undefined): void => {
    if (!value) {
      return;
    }

    const normalized = normalizeGatewayBaseUrl(value);
    if (seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    gateways.push(normalized);
  };

  pushGateway(params.explicitGatewayBaseUrl);
  pushGateway(DEFAULT_ARWEAVE_GATEWAY_BASE_URL);

  return gateways;
}

export function buildTransactionUrl(params: { gatewayBaseUrl?: string; txId: string }): string {
  return appendUrlSegment(params.gatewayBaseUrl ?? DEFAULT_ARWEAVE_GATEWAY_BASE_URL, params.txId);
}

export function inferContentTypeFromPath(pathOrUrl: string): string {
  const extension = extname(new URL(pathOrUrl, "https://doomindex.fun").pathname).toLowerCase();
  return CONTENT_TYPES_BY_EXTENSION[extension] ?? DEFAULT_CONTENT_TYPE;
}

export function buildMetadataJson(params: {
  animationUrl: string;
  imageContentType: string;
  imageUrl: string;
  paintingId?: string;
  tokenId: number;
}): MetadataJson {
  const attributes: MetadataJson["attributes"] = [{ trait_type: "Token ID", value: params.tokenId }];

  if (params.paintingId) {
    attributes.push({ trait_type: "Painting ID", value: params.paintingId });
  }

  return {
    animation_url: params.animationUrl,
    attributes,
    description: METADATA_DESCRIPTION,
    external_url: `https://doomindex.fun/artworks/${String(params.tokenId)}`,
    image: params.imageUrl,
    name: `DOOM INDEX #${String(params.tokenId)}`,
    properties: {
      category: "vr",
      files: [
        { type: params.imageContentType, uri: params.imageUrl },
        { type: "model/gltf-binary", uri: params.animationUrl },
      ],
    },
    symbol: "DOOM",
  };
}

export function buildManifestJson(params: { metadataId: string; tokenId: number }): ArweavePathManifest {
  const tokenPath = String(params.tokenId);

  return {
    manifest: "arweave/paths",
    paths: {
      [tokenPath]: { id: params.metadataId },
    },
    version: MANIFEST_VERSION,
  };
}

export function buildTokenMetadataUrl(params: {
  gatewayBaseUrl?: string;
  manifestId: string;
  tokenId: number;
}): string {
  return appendUrlSegment(
    buildTransactionUrl({
      gatewayBaseUrl: params.gatewayBaseUrl,
      txId: params.manifestId,
    }),
    String(params.tokenId),
  );
}

export function buildBaseMetadataUrl(params: { gatewayBaseUrl?: string; manifestId: string }): string {
  return buildTransactionUrl({
    gatewayBaseUrl: params.gatewayBaseUrl,
    txId: params.manifestId,
  });
}

export function buildPreferredAssetUrl(params: {
  explicitGatewayBaseUrl?: string;
  uploadResult: { id: string };
}): string {
  const [gatewayBaseUrl] = buildGatewayBaseUrls({ explicitGatewayBaseUrl: params.explicitGatewayBaseUrl });

  return buildTransactionUrl({
    gatewayBaseUrl,
    txId: params.uploadResult.id,
  });
}

async function isUrlReachable(params: { fetchImpl?: typeof fetch; timeoutMs?: number; url: string }): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, params.timeoutMs ?? DEFAULT_GATEWAY_PROBE_TIMEOUT_MS);

  try {
    const response = await (params.fetchImpl ?? fetch)(params.url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function resolveTokenMetadataGateway(params: {
  explicitGatewayBaseUrl?: string;
  fetchImpl?: typeof fetch;
  manifestUploadResult: { id: string };
  tokenId: number;
}): Promise<{ baseMetadataUrl: string; resolvedFromProbe: boolean; tokenMetadataUrl: string }> {
  const gatewayBaseUrls = buildGatewayBaseUrls({ explicitGatewayBaseUrl: params.explicitGatewayBaseUrl });

  for (const gatewayBaseUrl of gatewayBaseUrls) {
    const tokenMetadataUrl = buildTokenMetadataUrl({
      gatewayBaseUrl,
      manifestId: params.manifestUploadResult.id,
      tokenId: params.tokenId,
    });

    if (
      await isUrlReachable({
        fetchImpl: params.fetchImpl,
        url: tokenMetadataUrl,
      })
    ) {
      return {
        baseMetadataUrl: buildBaseMetadataUrl({
          gatewayBaseUrl,
          manifestId: params.manifestUploadResult.id,
        }),
        resolvedFromProbe: true,
        tokenMetadataUrl,
      };
    }
  }

  const fallbackGatewayBaseUrl = gatewayBaseUrls[0] ?? DEFAULT_ARWEAVE_GATEWAY_BASE_URL;

  return {
    baseMetadataUrl: buildBaseMetadataUrl({
      gatewayBaseUrl: fallbackGatewayBaseUrl,
      manifestId: params.manifestUploadResult.id,
    }),
    resolvedFromProbe: false,
    tokenMetadataUrl: buildTokenMetadataUrl({
      gatewayBaseUrl: fallbackGatewayBaseUrl,
      manifestId: params.manifestUploadResult.id,
      tokenId: params.tokenId,
    }),
  };
}

function stringifyTurboFundingMessage(payload: TurboFundingNotificationPayload): string {
  const autoTopUpSuffix =
    payload.autoTopUpAmountWinston === undefined
      ? "auto top-up disabled"
      : `auto top-up ${String(payload.autoTopUpAmountWinston)} winston`;

  return [
    "DOOM INDEX Turbo balance is low.",
    `Current balance: ${String(payload.currentBalanceWinc)} winc`,
    `Estimated upload cost: ${String(payload.estimatedCostWinc)} winc`,
    `Projected remaining balance: ${String(payload.remainingBalanceWinc)} winc`,
    autoTopUpSuffix,
  ].join("\n");
}

async function notifyTurboFundingStatus(message: string): Promise<void> {
  console.warn(message);

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  await fetch(webhookUrl, {
    body: JSON.stringify({ text: message }),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

function sumWincStrings(values: string[]): bigint {
  return values.reduce((sum, value) => sum + BigInt(value), BigInt(0));
}

export async function ensureTurboUploadFunding(params: {
  ardrive: Pick<ArdriveClient, "getBalance" | "getUploadCosts" | "topUpWithTokens">;
  autoTopUpAmountWinston?: bigint;
  byteCounts: number[];
  notify?: (message: string) => Promise<void>;
  notifyThresholdWinc?: bigint;
}): Promise<TurboFundingCheckResult> {
  const balanceResult = await params.ardrive.getBalance();
  if (balanceResult.isErr()) {
    throw new Error(`Turbo balance check failed: ${balanceResult.error.message}`);
  }

  const costResult = await params.ardrive.getUploadCosts(params.byteCounts);
  if (costResult.isErr()) {
    throw new Error(`Turbo upload cost estimate failed: ${costResult.error.message}`);
  }

  const currentBalanceWinc = BigInt(balanceResult.value.winc);
  const estimatedCostWinc = sumWincStrings(costResult.value.map((price) => price.winc));
  const remainingBalanceWinc = currentBalanceWinc - estimatedCostWinc;
  const notifyThresholdWinc = params.notifyThresholdWinc ?? BigInt(0);
  const shouldNotify = remainingBalanceWinc <= notifyThresholdWinc;

  let didNotify = false;
  let topUpTransactionId: string | undefined;

  if (shouldNotify) {
    const message = stringifyTurboFundingMessage({
      autoTopUpAmountWinston: params.autoTopUpAmountWinston,
      currentBalanceWinc,
      estimatedCostWinc,
      remainingBalanceWinc,
    });
    didNotify = true;
    await (params.notify ?? notifyTurboFundingStatus)(message);
  }

  if (shouldNotify && params.autoTopUpAmountWinston !== undefined) {
    const topUpResult = await params.ardrive.topUpWithTokens({
      tokenAmount: params.autoTopUpAmountWinston.toString(),
    });
    if (topUpResult.isErr()) {
      throw new Error(`Turbo top-up failed: ${topUpResult.error.message}`);
    }
    topUpTransactionId = topUpResult.value.id;
  }

  return {
    currentBalanceWinc,
    didNotify,
    didTopUp: topUpTransactionId !== undefined,
    estimatedCostWinc,
    remainingBalanceWinc,
    topUpTransactionId,
  };
}

function isRemoteAssetPath(pathOrUrl: string): boolean {
  return pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://");
}

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

async function loadAsset(pathOrUrl: string, fallbackContentType: string): Promise<LoadedAsset> {
  if (isRemoteAssetPath(pathOrUrl)) {
    const response = await fetch(pathOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${pathOrUrl}: ${String(response.status)} ${response.statusText}`);
    }

    return {
      bytes: await readResponseBytes(response),
      contentType: response.headers.get("content-type") ?? fallbackContentType,
      source: pathOrUrl,
    };
  }

  if (!existsSync(pathOrUrl)) {
    throw new Error(`File not found: ${pathOrUrl}`);
  }

  const file = Bun.file(pathOrUrl);
  return {
    bytes: await file.bytes(),
    contentType: file.type || fallbackContentType,
    source: pathOrUrl,
  };
}

function buildBaseTags(paintingId?: string): Tag[] {
  if (!paintingId) {
    return [];
  }

  return [{ name: "Painting-Id", value: paintingId }];
}

async function main(): Promise<void> {
  const { tokenId, thumbnail, glb, gateway, paintingId, dryRun } = parseArgs();
  const explicitGatewayBaseUrl = gateway ?? process.env.ARWEAVE_GATEWAY_BASE_URL;

  console.log("[1/6] Loading thumbnail...");
  const thumbnailAsset = await loadAsset(thumbnail, inferContentTypeFromPath(thumbnail));
  console.log(`  Source: ${thumbnailAsset.source}`);
  console.log(`  Size:   ${String(thumbnailAsset.bytes.byteLength)} bytes`);
  console.log(`  Type:   ${thumbnailAsset.contentType}`);

  console.log("[2/6] Loading GLB...");
  const glbAsset = await loadAsset(glb, "model/gltf-binary");
  console.log(`  Source: ${glbAsset.source}`);
  console.log(`  Size:   ${String(glbAsset.bytes.byteLength)} bytes`);
  console.log(`  Type:   ${glbAsset.contentType}`);

  const dryRunMetadata = buildMetadataJson({
    animationUrl: buildTransactionUrl({ txId: "<animation-tx-id>" }),
    imageContentType: thumbnailAsset.contentType,
    imageUrl: buildTransactionUrl({ txId: "<thumbnail-tx-id>" }),
    paintingId,
    tokenId,
  });
  const dryRunManifest = buildManifestJson({
    metadataId: "<metadata-tx-id>",
    tokenId,
  });
  const metadataBytes = JSON_ENCODER.encode(JSON.stringify(dryRunMetadata));
  const manifestBytes = JSON_ENCODER.encode(JSON.stringify(dryRunManifest));

  if (dryRun) {
    console.log("\n--- metadata.json ---");
    console.log(JSON.stringify(dryRunMetadata, null, 2));
    console.log("\n--- path-manifest.json ---");
    console.log(JSON.stringify(dryRunManifest, null, 2));
    console.log("\n--- token urls ---");
    console.log(
      buildTokenMetadataUrl({
        gatewayBaseUrl: explicitGatewayBaseUrl,
        manifestId: "<manifest-tx-id>",
        tokenId,
      }),
    );
    console.log("\n[dry-run] Done. No uploads performed.");
    return;
  }

  const ardrive = createArdriveClient({ secretKey: process.env.ARDRIVE_TURBO_SECRET_KEY });
  await ensureTurboUploadFunding({
    ardrive,
    autoTopUpAmountWinston: parseOptionalBigInt(
      process.env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
      "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
    ),
    byteCounts: [
      thumbnailAsset.bytes.byteLength,
      glbAsset.bytes.byteLength,
      metadataBytes.byteLength,
      manifestBytes.byteLength,
    ],
    notifyThresholdWinc: parseOptionalBigInt(
      process.env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
      "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
    ),
  });
  const baseTags = buildBaseTags(paintingId);

  console.log("[3/6] Uploading thumbnail to Arweave...");
  const thumbnailResult = await ardrive.uploadFile(thumbnailAsset.bytes, thumbnailAsset.contentType, [
    ...baseTags,
    { name: "File-Type", value: THUMBNAIL_FILE_TYPE },
  ]);
  if (thumbnailResult.isErr()) {
    throw new Error(`Thumbnail upload failed: ${thumbnailResult.error.message}`);
  }
  console.log(`  TX:  ${thumbnailResult.value.id}`);
  console.log(`  URL: ${thumbnailResult.value.url}`);

  console.log("[4/6] Uploading GLB to Arweave...");
  const glbResult = await ardrive.uploadFile(glbAsset.bytes, glbAsset.contentType, [
    ...baseTags,
    { name: "File-Type", value: ANIMATION_FILE_TYPE },
  ]);
  if (glbResult.isErr()) {
    throw new Error(`GLB upload failed: ${glbResult.error.message}`);
  }
  console.log(`  TX:  ${glbResult.value.id}`);
  console.log(`  URL: ${glbResult.value.url}`);

  const metadataJson = buildMetadataJson({
    animationUrl: buildPreferredAssetUrl({
      explicitGatewayBaseUrl,
      uploadResult: glbResult.value,
    }),
    imageContentType: thumbnailAsset.contentType,
    imageUrl: buildPreferredAssetUrl({
      explicitGatewayBaseUrl,
      uploadResult: thumbnailResult.value,
    }),
    paintingId,
    tokenId,
  });

  console.log("[5/6] Uploading metadata.json to Arweave...");
  const metadataResult = await ardrive.uploadJson(metadataJson, [
    ...baseTags,
    { name: "File-Type", value: METADATA_FILE_TYPE },
  ]);
  if (metadataResult.isErr()) {
    throw new Error(`Metadata upload failed: ${metadataResult.error.message}`);
  }
  console.log(`  TX:  ${metadataResult.value.id}`);
  console.log(`  URL: ${metadataResult.value.url}`);

  const manifestJson = buildManifestJson({
    metadataId: metadataResult.value.id,
    tokenId,
  });

  console.log("[6/6] Uploading path manifest to Arweave...");
  const manifestResult = await ardrive.uploadFile(
    JSON_ENCODER.encode(JSON.stringify(manifestJson)),
    MANIFEST_CONTENT_TYPE,
    [...baseTags, { name: "File-Type", value: MANIFEST_FILE_TYPE }],
  );
  if (manifestResult.isErr()) {
    throw new Error(`Manifest upload failed: ${manifestResult.error.message}`);
  }
  console.log(`  TX:  ${manifestResult.value.id}`);
  console.log(`  URL: ${manifestResult.value.url}`);

  const gatewayResolution = await resolveTokenMetadataGateway({
    explicitGatewayBaseUrl,
    manifestUploadResult: manifestResult.value,
    tokenId,
  });

  console.log("\nUpload complete!");
  console.log(`  Thumbnail: ${thumbnailResult.value.url}`);
  console.log(`  GLB:       ${glbResult.value.url}`);
  console.log(`  Metadata:  ${metadataResult.value.url}`);
  console.log(`  Base URL:  ${gatewayResolution.baseMetadataUrl}`);
  console.log(`  Token URI: ${gatewayResolution.tokenMetadataUrl}`);
  if (!gatewayResolution.resolvedFromProbe) {
    console.warn(
      "  Warning: no candidate gateway resolved the manifest path immediately; falling back to the highest-priority gateway.",
    );
  }
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
