import { env } from "@/env";
import { createArdriveClient } from "@/lib/ardrive-client";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { err, ok } from "neverthrow";
import type { Result } from "neverthrow";
import { ensureTurboUploadFunding, parseOptionalBigInt, uploadPaintingImageAsset } from "./arweave-services";

export interface StoredPaintingAssets {
  imageTxId: string;
  imageUrl: string;
}

export async function storePaintingAssets(params: {
  assetsFetcher?: Fetcher;
  explicitGatewayBaseUrl?: string;
  imageBuffer: ArrayBuffer;
  imageContentType?: string;
  paintingId: string;
}): Promise<Result<StoredPaintingAssets, AppError>> {
  logger.info("[storePaintingAssets] Starting", {
    paintingId: params.paintingId,
    imageSize: params.imageBuffer.byteLength,
    imageContentType: params.imageContentType ?? "image/webp",
    hasAssetsFetcher: !!params.assetsFetcher,
  });

  const ardrive = createArdriveClient({
    secretKey: env.ARDRIVE_TURBO_SECRET_KEY,
  });

  logger.info("[storePaintingAssets] Checking Turbo upload funding...");
  const fundingResult = await ensureTurboUploadFunding({
    ardrive,
    autoTopUpAmountWinston: parseOptionalBigInt(
      env.ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON,
      "ARDRIVE_TURBO_AUTO_TOP_UP_AMOUNT_WINSTON",
    ),
    byteCounts: [params.imageBuffer.byteLength],
    notifyThresholdWinc: parseOptionalBigInt(
      env.ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC,
      "ARDRIVE_TURBO_LOW_BALANCE_NOTIFY_THRESHOLD_WINC",
    ),
  });
  if (fundingResult.isErr()) {
    logger.error("[storePaintingAssets] Funding check failed", { error: fundingResult.error });
    return err(fundingResult.error);
  }
  logger.info("[storePaintingAssets] Funding check passed", {
    currentBalanceWinc: String(fundingResult.value.currentBalanceWinc),
    estimatedCostWinc: String(fundingResult.value.estimatedCostWinc),
    remainingBalanceWinc: String(fundingResult.value.remainingBalanceWinc),
    didTopUp: fundingResult.value.didTopUp,
  });

  logger.info("[storePaintingAssets] Uploading image to Arweave...");
  const uploadResult = await uploadPaintingImageAsset({
    ardrive,
    explicitGatewayBaseUrl: params.explicitGatewayBaseUrl ?? env.ARWEAVE_GATEWAY_BASE_URL,
    image: {
      bytes: new Uint8Array(params.imageBuffer),
      contentType: params.imageContentType ?? "image/webp",
    },
    paintingId: params.paintingId,
  });

  if (uploadResult.isOk()) {
    logger.info("[storePaintingAssets] Upload completed", {
      imageTxId: uploadResult.value.imageTxId,
      imageUrl: uploadResult.value.imageUrl,
    });
  } else {
    logger.error("[storePaintingAssets] Upload failed", { error: uploadResult.error });
  }

  return uploadResult;
}
