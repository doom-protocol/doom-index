import { env } from "@/env";
import { createArdriveClient } from "@/lib/ardrive-client";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import { inferContentTypeFromPath } from "@/server/services/paintings/asset-loader";
import type { AppError } from "@/types/app-error";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { buildFramedPaintingGlbFromPublicFrame } from "./framed-painting-bundle-service";
import {
  buildManifestJson,
  buildMetadataJson,
  buildTransactionUrl,
  ensureTurboUploadFunding,
  parseOptionalBigInt,
  uploadNftMetadataBundle,
  uploadPaintingGlbAsset,
} from "./arweave-services";

const DEFAULT_PAINTING_IMAGE_CONTENT_TYPE = "image/webp";
const ARWEAVE_TX_ID_PLACEHOLDER = "x".repeat(43);

function normalizeContentType(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value.split(";")[0]?.trim().toLowerCase() || undefined;
}

async function detectPaintingImageContentType(imageUrl: string, fetchImpl?: typeof fetch): Promise<string> {
  const inferred = normalizeContentType(inferContentTypeFromPath(imageUrl));
  if (inferred && inferred !== "application/octet-stream") {
    return inferred;
  }

  for (const method of ["HEAD", "GET"] as const) {
    try {
      const response = await (fetchImpl ?? fetch)(imageUrl, {
        method,
        redirect: "follow",
      });
      const headerContentType = normalizeContentType(response.headers.get("content-type"));
      if (headerContentType) {
        return headerContentType;
      }
    } catch {
      // Fall through to the next detection path.
    }
  }

  return DEFAULT_PAINTING_IMAGE_CONTENT_TYPE;
}

async function loadPaintingImageAsset(
  imageUrl: string,
  fetchImpl?: typeof fetch,
): Promise<
  Result<
    {
      bytes: ArrayBuffer;
      contentType: string;
    },
    AppError
  >
> {
  try {
    const response = await (fetchImpl ?? fetch)(imageUrl, {
      method: "GET",
      redirect: "follow",
    });
    if (!response.ok) {
      return err({
        type: "StorageError",
        key: imageUrl,
        message: `Failed to fetch painting image ${imageUrl}: ${String(response.status)} ${response.statusText}`,
        op: "get",
        status: response.status,
      });
    }

    return ok({
      bytes: await response.arrayBuffer(),
      contentType:
        normalizeContentType(response.headers.get("content-type")) ??
        normalizeContentType(inferContentTypeFromPath(imageUrl)) ??
        DEFAULT_PAINTING_IMAGE_CONTENT_TYPE,
    });
  } catch (error) {
    return err({
      type: "StorageError",
      key: imageUrl,
      message: `Failed to fetch painting image ${imageUrl}: ${error instanceof Error ? error.message : String(error)}`,
      op: "get",
    });
  }
}

function getMetadataFundingByteCounts(params: {
  glbUrl: string;
  imageContentType: string;
  imageUrl: string;
  paintingId: string;
  tokenId: string;
}): number[] {
  const metadataJson = JSON.stringify(
    buildMetadataJson({
      animationUrl: params.glbUrl,
      imageContentType: params.imageContentType,
      imageUrl: params.imageUrl,
      paintingId: params.paintingId,
      tokenId: params.tokenId,
    }),
  );
  const manifestJson = JSON.stringify(
    buildManifestJson({
      metadataId: ARWEAVE_TX_ID_PLACEHOLDER,
      tokenId: params.tokenId,
    }),
  );

  return [metadataJson.length, manifestJson.length];
}

export async function preparePaintingMintMetadata(params: {
  d1Binding?: D1Database;
  fetchImpl?: typeof fetch;
  paintingId: string;
  tokenId: string;
}): Promise<
  Result<
    {
      baseMetadataUrl: string;
      manifestTxId: string;
      metadataTxId: string;
      resolvedFromProbe: boolean;
      tokenMetadataUrl: string;
    },
    AppError
  >
> {
  const repo = createPaintingsRepository({ d1Binding: params.d1Binding });
  const paintingResult = await repo.findById(params.paintingId);
  if (paintingResult.isErr()) {
    return err(paintingResult.error);
  }

  const painting = paintingResult.value;
  if (!painting) {
    return err({
      type: "StorageError",
      op: "get",
      key: params.paintingId,
      message: `Painting not found: ${params.paintingId}`,
    });
  }

  const ardrive = createArdriveClient({
    secretKey: env.ARDRIVE_TURBO_SECRET_KEY,
  });
  let glbUrl = painting.glbUrl;
  let imageContentType = await detectPaintingImageContentType(painting.imageUrl, params.fetchImpl);

  if (!glbUrl) {
    const imageAssetResult = await loadPaintingImageAsset(painting.imageUrl, params.fetchImpl);
    if (imageAssetResult.isErr()) {
      return err(imageAssetResult.error);
    }

    imageContentType = imageAssetResult.value.contentType;

    const glbCompositionResult = await buildFramedPaintingGlbFromPublicFrame({
      paintingImageBuffer: imageAssetResult.value.bytes,
      paintingImageContentType: imageContentType,
    });
    if (glbCompositionResult.isErr()) {
      return err(glbCompositionResult.error);
    }

    const byteCounts = [
      glbCompositionResult.value.byteLength,
      ...getMetadataFundingByteCounts({
        glbUrl: buildTransactionUrl({
          gatewayBaseUrl: env.ARWEAVE_GATEWAY_BASE_URL,
          txId: ARWEAVE_TX_ID_PLACEHOLDER,
        }),
        imageContentType,
        imageUrl: painting.imageUrl,
        paintingId: painting.id,
        tokenId: params.tokenId,
      }),
    ];

    const fundingResult = await ensureTurboUploadFunding({
      ardrive,
      autoTopUpAmountWinston: parseOptionalBigInt(
        env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
        "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
      ),
      byteCounts,
      notifyThresholdWinc: parseOptionalBigInt(
        env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
        "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
      ),
    });
    if (fundingResult.isErr()) {
      return err(fundingResult.error);
    }

    const glbUploadResult = await uploadPaintingGlbAsset({
      ardrive,
      explicitGatewayBaseUrl: env.ARWEAVE_GATEWAY_BASE_URL,
      glb: {
        bytes: new Uint8Array(glbCompositionResult.value),
        contentType: "model/gltf-binary",
      },
      paintingId: painting.id,
    });
    if (glbUploadResult.isErr()) {
      return err(glbUploadResult.error);
    }

    const updateMintAssetRefsResult = await repo.updateMintAssetRefs(painting.id, {
      glbTxId: glbUploadResult.value.glbTxId,
      glbUrl: glbUploadResult.value.glbUrl,
    });
    if (updateMintAssetRefsResult.isErr()) {
      return err(updateMintAssetRefsResult.error);
    }

    glbUrl = glbUploadResult.value.glbUrl;
  } else {
    const byteCounts = getMetadataFundingByteCounts({
      glbUrl,
      imageContentType,
      imageUrl: painting.imageUrl,
      paintingId: painting.id,
      tokenId: params.tokenId,
    });

    const fundingResult = await ensureTurboUploadFunding({
      ardrive,
      autoTopUpAmountWinston: parseOptionalBigInt(
        env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
        "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
      ),
      byteCounts,
      notifyThresholdWinc: parseOptionalBigInt(
        env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
        "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
      ),
    });
    if (fundingResult.isErr()) {
      return err(fundingResult.error);
    }
  }

  return uploadNftMetadataBundle({
    ardrive,
    explicitGatewayBaseUrl: env.ARWEAVE_GATEWAY_BASE_URL,
    fetchImpl: params.fetchImpl,
    glbUrl,
    imageContentType,
    imageUrl: painting.imageUrl,
    paintingId: painting.id,
    tokenId: params.tokenId,
  });
}
