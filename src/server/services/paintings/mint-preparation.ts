import { env } from "@/env";
import { createArdriveClient } from "@/lib/ardrive-client";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import type { AppError } from "@/types/app-error";
import { err } from "neverthrow";
import type { Result } from "neverthrow";
import { ensureTurboUploadFunding, parseOptionalBigInt, uploadNftMetadataBundle } from "./arweave-services";

export async function preparePaintingMintMetadata(params: {
  d1Binding?: D1Database;
  fetchImpl?: typeof fetch;
  paintingId: string;
  tokenId: number;
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
      [String(params.tokenId)]: {
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
    imageContentType: "image/webp",
    imageUrl: painting.imageUrl,
    paintingId: painting.id,
    tokenId: params.tokenId,
  });
}
