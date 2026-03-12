import { env } from "@/env";
import { createArdriveClient } from "@/lib/ardrive-client";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import { inferContentTypeFromPath } from "@/server/services/paintings/asset-loader";
import type { AppError } from "@/types/app-error";
import { err } from "neverthrow";
import type { Result } from "neverthrow";
import { ensureTurboUploadFunding, parseOptionalBigInt, uploadNftMetadataBundle } from "./arweave-services";

const DEFAULT_PAINTING_IMAGE_CONTENT_TYPE = "image/webp";

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

  if (!painting.glbUrl) {
    return err({
      type: "ValidationError",
      message: `Painting ${params.paintingId} does not have a GLB URL`,
    });
  }

  const imageContentType = await detectPaintingImageContentType(painting.imageUrl, params.fetchImpl);
  const ardrive = createArdriveClient({
    secretKey: env.ARDRIVE_TURBO_SECRET_KEY,
  });

  const metadataJson = JSON.stringify({
    tokenId: params.tokenId,
    imageUrl: painting.imageUrl,
    glbUrl: painting.glbUrl,
    paintingId: painting.id,
  });
  const manifestJson = JSON.stringify({
    manifest: "arweave/paths",
    version: "0.2.0",
    paths: {
      [params.tokenId]: {
        id: "placeholder",
      },
    },
  });

  const fundingResult = await ensureTurboUploadFunding({
    ardrive,
    autoTopUpAmountWinston: parseOptionalBigInt(
      env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
      "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
    ),
    byteCounts: [metadataJson.length, manifestJson.length],
    notifyThresholdWinc: parseOptionalBigInt(
      env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
      "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
    ),
  });
  if (fundingResult.isErr()) {
    return err(fundingResult.error);
  }

  return uploadNftMetadataBundle({
    ardrive,
    explicitGatewayBaseUrl: env.ARWEAVE_GATEWAY_BASE_URL,
    fetchImpl: params.fetchImpl,
    glbUrl: painting.glbUrl,
    imageContentType,
    imageUrl: painting.imageUrl,
    paintingId: painting.id,
    tokenId: params.tokenId,
  });
}
