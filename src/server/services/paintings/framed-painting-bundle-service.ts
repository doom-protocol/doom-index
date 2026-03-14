import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";
import { err } from "neverthrow";
import type { Result } from "neverthrow";
import { loadPublicAsset } from "./asset-loader";
import { composeFramedPaintingGlb } from "./framed-glb-composition-service";

export function copyBytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

export async function buildFramedPaintingGlbFromPublicFrame(params: {
  assetsFetcher?: Fetcher;
  paintingImageBuffer: ArrayBuffer;
  paintingImageContentType: string;
}): Promise<Result<ArrayBuffer, AppError>> {
  logger.debug("[buildFramedPaintingGlbFromPublicFrame] Loading frame.glb from public assets...", {
    hasAssetsFetcher: !!params.assetsFetcher,
    paintingImageSize: params.paintingImageBuffer.byteLength,
    paintingImageContentType: params.paintingImageContentType,
  });

  const frameAsset = await loadPublicAsset({
    assetsFetcher: params.assetsFetcher,
    path: "/frame.glb",
  });
  if (frameAsset.isErr()) {
    logger.error("[buildFramedPaintingGlbFromPublicFrame] Failed to load frame.glb", {
      error: frameAsset.error,
    });
    return err(frameAsset.error);
  }

  logger.debug("[buildFramedPaintingGlbFromPublicFrame] frame.glb loaded", {
    frameSize: frameAsset.value.bytes.byteLength,
    source: frameAsset.value.source,
  });

  const result = composeFramedPaintingGlb({
    frameGlbBuffer: copyBytesToArrayBuffer(frameAsset.value.bytes),
    paintingImageBuffer: params.paintingImageBuffer,
    paintingImageContentType: params.paintingImageContentType,
  });

  if (result.isOk()) {
    logger.debug("[buildFramedPaintingGlbFromPublicFrame] Composition complete", {
      outputSize: result.value.byteLength,
    });
  }

  return result;
}
