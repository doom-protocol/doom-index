import { DEFAULT_ARWEAVE_GATEWAY_BASE_URL } from "@/constants/arweave";
import type { ArdriveClient, Tag } from "@/lib/ardrive-client";
import { sendSlackMessage } from "@/lib/slack-client";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";

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
  notifyThresholdWinc: bigint;
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

interface UploadedPaintingAssetBundle {
  glbTxId: string;
  glbUrl: string;
  imageTxId: string;
  imageUrl: string;
}

interface UploadedPaintingImageAsset {
  imageTxId: string;
  imageUrl: string;
}

interface UploadedPaintingGlbAsset {
  glbTxId: string;
  glbUrl: string;
}

interface UploadedNftMetadataBundle {
  baseMetadataUrl: string;
  manifestTxId: string;
  metadataTxId: string;
  resolvedFromProbe: boolean;
  tokenMetadataUrl: string;
}

type TokenId = bigint | number | string;

const DEFAULT_GATEWAY_PROBE_TIMEOUT_MS = 1500;
const MANIFEST_CONTENT_TYPE = "application/x.arweave-manifest+json";
const MANIFEST_VERSION = "0.2.0";
const METADATA_DESCRIPTION =
  "A generative artwork from DOOM INDEX - an AI-powered decentralized archive of financial emotions.";

export function parseOptionalBigInt(value: string | undefined, envName: string): bigint | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return BigInt(value);
  } catch {
    throw new Error(`${envName} must be an integer string`);
  }
}

function appendUrlSegment(baseUrl: string, segment: string): string {
  return `${normalizeGatewayBaseUrl(baseUrl)}/${segment}`;
}

export function normalizeGatewayBaseUrl(gatewayBaseUrl: string): string {
  const normalized = gatewayBaseUrl.trim().replace(/\/+$/u, "");

  if (!normalized) {
    throw new Error("Gateway base URL must not be empty");
  }

  return new URL(normalized).toString().replace(/\/+$/u, "");
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

export function buildMetadataJson(params: {
  animationUrl: string;
  imageContentType: string;
  imageUrl: string;
  paintingId?: string;
  tokenId: TokenId;
}): MetadataJson {
  const normalizedTokenId = String(params.tokenId);
  const attributes: MetadataJson["attributes"] = [
    {
      trait_type: "Token ID",
      value: typeof params.tokenId === "number" ? params.tokenId : normalizedTokenId,
    },
  ];

  if (params.paintingId) {
    attributes.push({ trait_type: "Painting ID", value: params.paintingId });
  }

  return {
    animation_url: params.animationUrl,
    attributes,
    description: METADATA_DESCRIPTION,
    external_url: `https://doomindex.fun/artworks/${normalizedTokenId}`,
    image: params.imageUrl,
    name: `DOOM INDEX #${normalizedTokenId}`,
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

export function buildManifestJson(params: { metadataId: string; tokenId: TokenId }): ArweavePathManifest {
  return {
    manifest: "arweave/paths",
    paths: {
      [String(params.tokenId)]: { id: params.metadataId },
    },
    version: MANIFEST_VERSION,
  };
}

export function buildTokenMetadataUrl(params: {
  gatewayBaseUrl?: string;
  manifestId: string;
  tokenId: TokenId;
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
  tokenId: TokenId;
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
  const headline =
    payload.remainingBalanceWinc < BigInt(0)
      ? "DOOM INDEX Turbo balance is likely insufficient for the pending upload."
      : payload.remainingBalanceWinc === BigInt(0)
        ? "DOOM INDEX Turbo balance will be fully consumed by the pending upload."
        : "DOOM INDEX Turbo balance is low.";
  const autoTopUpSuffix =
    payload.autoTopUpAmountWinston === undefined
      ? "auto top-up disabled"
      : `auto top-up ${String(payload.autoTopUpAmountWinston)} winston`;

  return [
    headline,
    `Current balance: ${String(payload.currentBalanceWinc)} winc`,
    `Estimated upload cost: ${String(payload.estimatedCostWinc)} winc`,
    `Projected remaining balance: ${String(payload.remainingBalanceWinc)} winc`,
    `Notify threshold: ${String(payload.notifyThresholdWinc)} winc`,
    autoTopUpSuffix,
  ].join("\n");
}

async function notifyTurboFundingStatus(message: string): Promise<void> {
  const result = await sendSlackMessage({ text: message });
  if (result.isErr()) {
    logger.warn("[notifyTurboFundingStatus] Slack notification failed", {
      error: result.error.message,
      type: result.error.type,
    });
  }
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
}): Promise<Result<TurboFundingCheckResult, AppError>> {
  const getBalance = async (): Promise<Result<bigint, AppError>> => {
    const balanceResult = await params.ardrive.getBalance();
    if (balanceResult.isErr()) {
      return err({
        type: "ExternalApiError",
        provider: "ardrive",
        message: `Turbo balance check failed: ${balanceResult.error.message}`,
        details: balanceResult.error,
      });
    }

    return ok(BigInt(balanceResult.value.winc));
  };

  const balanceResult = await getBalance();
  if (balanceResult.isErr()) {
    return err(balanceResult.error);
  }

  const costResult = await params.ardrive.getUploadCosts(params.byteCounts);
  if (costResult.isErr()) {
    return err({
      type: "ExternalApiError",
      provider: "ardrive",
      message: `Turbo upload cost estimate failed: ${costResult.error.message}`,
      details: costResult.error,
    });
  }

  const currentBalanceWinc = balanceResult.value;
  const estimatedCostWinc = sumWincStrings(costResult.value.map((price) => price.winc));
  let remainingBalanceWinc = currentBalanceWinc - estimatedCostWinc;
  const notifyThresholdWinc = params.notifyThresholdWinc ?? BigInt(0);
  const shouldNotify = remainingBalanceWinc <= notifyThresholdWinc;

  let didNotify = false;
  let topUpTransactionId: string | undefined;

  if (shouldNotify) {
    const message = stringifyTurboFundingMessage({
      autoTopUpAmountWinston: params.autoTopUpAmountWinston,
      currentBalanceWinc,
      estimatedCostWinc,
      notifyThresholdWinc,
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
      return err({
        type: "ExternalApiError",
        provider: "ardrive",
        message: `Turbo top-up failed: ${topUpResult.error.message}`,
        details: topUpResult.error,
      });
    }
    topUpTransactionId = topUpResult.value.id;

    const postTopUpBalanceResult = await getBalance();
    if (postTopUpBalanceResult.isErr()) {
      return err(postTopUpBalanceResult.error);
    }

    remainingBalanceWinc = postTopUpBalanceResult.value - estimatedCostWinc;
  }

  if (remainingBalanceWinc < BigInt(0)) {
    return err({
      type: "ExternalApiError",
      provider: "ardrive",
      message: `Turbo balance is insufficient for upload: need ${String(estimatedCostWinc)} winc, projected remaining ${String(remainingBalanceWinc)} winc`,
    });
  }

  return ok({
    currentBalanceWinc,
    didNotify,
    didTopUp: topUpTransactionId !== undefined,
    estimatedCostWinc,
    remainingBalanceWinc,
    topUpTransactionId,
  });
}

function buildBaseTags(paintingId?: string): Tag[] {
  if (!paintingId) {
    return [];
  }

  return [{ name: "Painting-Id", value: paintingId }];
}

export async function uploadPaintingAssetBundle(params: {
  ardrive: Pick<ArdriveClient, "uploadFile">;
  explicitGatewayBaseUrl?: string;
  image: {
    bytes: Uint8Array;
    contentType: string;
  };
  glb: {
    bytes: Uint8Array;
    contentType: string;
  };
  paintingId?: string;
}): Promise<Result<UploadedPaintingAssetBundle, AppError>> {
  const imageUploadResult = await uploadPaintingImageAsset({
    ardrive: params.ardrive,
    explicitGatewayBaseUrl: params.explicitGatewayBaseUrl,
    image: params.image,
    paintingId: params.paintingId,
  });
  if (imageUploadResult.isErr()) {
    return err(imageUploadResult.error);
  }

  const glbUploadResult = await uploadPaintingGlbAsset({
    ardrive: params.ardrive,
    explicitGatewayBaseUrl: params.explicitGatewayBaseUrl,
    glb: params.glb,
    paintingId: params.paintingId,
  });
  if (glbUploadResult.isErr()) {
    return err(glbUploadResult.error);
  }

  return ok({
    glbTxId: glbUploadResult.value.glbTxId,
    glbUrl: glbUploadResult.value.glbUrl,
    imageTxId: imageUploadResult.value.imageTxId,
    imageUrl: imageUploadResult.value.imageUrl,
  });
}

async function uploadPaintingAsset(params: {
  ardrive: Pick<ArdriveClient, "uploadFile">;
  asset: {
    bytes: Uint8Array;
    contentType: string;
  };
  explicitGatewayBaseUrl?: string;
  fileType: "animation" | "thumbnail";
  logPrefix: "GLB" | "image";
  paintingId?: string;
}): Promise<Result<{ txId: string; url: string }, AppError>> {
  const baseTags = buildBaseTags(params.paintingId);

  logger.info(`[uploadPainting${params.logPrefix}Asset] Uploading ${params.logPrefix} to Arweave...`, {
    paintingId: params.paintingId,
    contentType: params.asset.contentType,
    size: params.asset.bytes.byteLength,
  });

  const uploadResult = await params.ardrive.uploadFile(params.asset.bytes, params.asset.contentType, [
    ...baseTags,
    { name: "File-Type", value: params.fileType },
  ]);
  if (uploadResult.isErr()) {
    logger.error(`[uploadPainting${params.logPrefix}Asset] Upload failed`, { error: uploadResult.error });
    return err(uploadResult.error);
  }

  logger.info(`[uploadPainting${params.logPrefix}Asset] Upload completed`, {
    txId: uploadResult.value.id,
  });

  return ok({
    txId: uploadResult.value.id,
    url: buildPreferredAssetUrl({
      explicitGatewayBaseUrl: params.explicitGatewayBaseUrl,
      uploadResult: uploadResult.value,
    }),
  });
}

export async function uploadPaintingImageAsset(params: {
  ardrive: Pick<ArdriveClient, "uploadFile">;
  explicitGatewayBaseUrl?: string;
  image: {
    bytes: Uint8Array;
    contentType: string;
  };
  paintingId?: string;
}): Promise<Result<UploadedPaintingImageAsset, AppError>> {
  const uploadResult = await uploadPaintingAsset({
    ardrive: params.ardrive,
    asset: params.image,
    explicitGatewayBaseUrl: params.explicitGatewayBaseUrl,
    fileType: "thumbnail",
    logPrefix: "image",
    paintingId: params.paintingId,
  });
  if (uploadResult.isErr()) {
    return err(uploadResult.error);
  }

  return ok({
    imageTxId: uploadResult.value.txId,
    imageUrl: uploadResult.value.url,
  });
}

export async function uploadPaintingGlbAsset(params: {
  ardrive: Pick<ArdriveClient, "uploadFile">;
  explicitGatewayBaseUrl?: string;
  glb: {
    bytes: Uint8Array;
    contentType: string;
  };
  paintingId?: string;
}): Promise<Result<UploadedPaintingGlbAsset, AppError>> {
  const uploadResult = await uploadPaintingAsset({
    ardrive: params.ardrive,
    asset: params.glb,
    explicitGatewayBaseUrl: params.explicitGatewayBaseUrl,
    fileType: "animation",
    logPrefix: "GLB",
    paintingId: params.paintingId,
  });
  if (uploadResult.isErr()) {
    return err(uploadResult.error);
  }

  return ok({
    glbTxId: uploadResult.value.txId,
    glbUrl: uploadResult.value.url,
  });
}

export async function uploadNftMetadataBundle(params: {
  ardrive: Pick<ArdriveClient, "uploadFile" | "uploadJson">;
  explicitGatewayBaseUrl?: string;
  fetchImpl?: typeof fetch;
  glbUrl: string;
  imageContentType: string;
  imageUrl: string;
  paintingId?: string;
  tokenId: TokenId;
}): Promise<Result<UploadedNftMetadataBundle, AppError>> {
  const metadataJson = buildMetadataJson({
    animationUrl: params.glbUrl,
    imageContentType: params.imageContentType,
    imageUrl: params.imageUrl,
    paintingId: params.paintingId,
    tokenId: params.tokenId,
  });

  const baseTags = buildBaseTags(params.paintingId);

  logger.info("[uploadNftMetadataBundle] Uploading metadata JSON...", { tokenId: params.tokenId });
  const metadataUploadResult = await params.ardrive.uploadJson(metadataJson, [
    ...baseTags,
    { name: "File-Type", value: "metadata" },
  ]);
  if (metadataUploadResult.isErr()) {
    logger.error("[uploadNftMetadataBundle] Metadata upload failed", { error: metadataUploadResult.error });
    return err(metadataUploadResult.error);
  }
  logger.info("[uploadNftMetadataBundle] Metadata uploaded", { metadataTxId: metadataUploadResult.value.id });

  const manifestJson = buildManifestJson({
    metadataId: metadataUploadResult.value.id,
    tokenId: params.tokenId,
  });

  logger.info("[uploadNftMetadataBundle] Uploading manifest...", { tokenId: params.tokenId });
  const manifestUploadResult = await params.ardrive.uploadFile(
    new TextEncoder().encode(JSON.stringify(manifestJson)),
    MANIFEST_CONTENT_TYPE,
    [...baseTags, { name: "File-Type", value: "manifest" }],
  );
  if (manifestUploadResult.isErr()) {
    logger.error("[uploadNftMetadataBundle] Manifest upload failed", { error: manifestUploadResult.error });
    return err(manifestUploadResult.error);
  }
  logger.info("[uploadNftMetadataBundle] Manifest uploaded", { manifestTxId: manifestUploadResult.value.id });

  const gatewayResolution = await resolveTokenMetadataGateway({
    explicitGatewayBaseUrl: params.explicitGatewayBaseUrl,
    fetchImpl: params.fetchImpl,
    manifestUploadResult: manifestUploadResult.value,
    tokenId: params.tokenId,
  });

  return ok({
    baseMetadataUrl: gatewayResolution.baseMetadataUrl,
    manifestTxId: manifestUploadResult.value.id,
    metadataTxId: metadataUploadResult.value.id,
    resolvedFromProbe: gatewayResolution.resolvedFromProbe,
    tokenMetadataUrl: gatewayResolution.tokenMetadataUrl,
  });
}
