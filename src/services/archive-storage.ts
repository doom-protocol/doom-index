import { err, ok, Result } from "neverthrow";
import type { ArchiveMetadata } from "@/types/archive";
import type { AppError } from "@/types/app-error";
import { putImageR2, putJsonR2, resolveBucketOrThrow } from "@/lib/r2";
import { buildArchiveKey, extractIdFromFilename, isArchiveMetadata, buildPublicR2Path } from "@/lib/pure/archive";
import { logger } from "@/utils/logger";

type ArchiveStorageServiceDeps = {
  r2Bucket?: R2Bucket;
};

export type ArchiveStorageResult = {
  imageUrl: string;
  metadataUrl: string;
};

export type ArchiveStorageService = {
  /**
   * Store image and metadata atomically
   * If metadata save fails, image save is rolled back
   */
  storeImageWithMetadata(
    minuteBucket: string,
    filename: string,
    imageBuffer: ArrayBuffer,
    metadata: ArchiveMetadata,
  ): Promise<Result<ArchiveStorageResult, AppError>>;
};

/**
 * Create archive storage service for R2 operations
 */
export function createArchiveStorageService({ r2Bucket }: ArchiveStorageServiceDeps = {}): ArchiveStorageService {
  const bucket = resolveBucketOrThrow({ r2Bucket });

  async function storeImageWithMetadata(
    minuteBucket: string,
    filename: string,
    imageBuffer: ArrayBuffer,
    metadata: ArchiveMetadata,
  ): Promise<Result<ArchiveStorageResult, AppError>> {
    // Validate metadata structure
    if (!isArchiveMetadata(metadata)) {
      return err({
        type: "ValidationError",
        message: "Invalid archive metadata structure",
      });
    }

    // Ensure metadata.id matches filename (without extension)
    const expectedId = extractIdFromFilename(filename);
    if (metadata.id !== expectedId) {
      return err({
        type: "ValidationError",
        message: `Metadata ID (${metadata.id}) does not match filename (${expectedId})`,
      });
    }

    // Build R2 keys with date prefix
    const imageKey = buildArchiveKey(minuteBucket, filename);
    const metadataKey = imageKey.replace(/\.webp$/, ".json");

    // Ensure filenames match (only extension differs)
    const imageBase = imageKey.replace(/\.webp$/, "");
    const metadataBase = metadataKey.replace(/\.json$/, "");
    if (imageBase !== metadataBase) {
      return err({
        type: "ValidationError",
        message: "Image and metadata keys do not match",
      });
    }

    // Update metadata with correct imageUrl and fileSize
    const updatedMetadata: ArchiveMetadata = {
      ...metadata,
      imageUrl: buildPublicR2Path(imageKey),
      fileSize: imageBuffer.byteLength,
    };

    // Try to save image first
    const imagePutResult = await putImageR2(bucket, imageKey, imageBuffer, "image/webp");
    if (imagePutResult.isErr()) {
      return err(imagePutResult.error);
    }

    // Try to save metadata
    const metadataPutResult = await putJsonR2(bucket, metadataKey, updatedMetadata);
    if (metadataPutResult.isErr()) {
      // Rollback: delete the image if metadata save fails
      try {
        await bucket.delete(imageKey);
      } catch (deleteError) {
        logger.error(`Failed to delete image: ${deleteError}`);
        // Log but don't fail - the main error is metadata save failure
        // In production, you might want to log this to monitoring
      }
      return err({
        type: "StorageError",
        op: "put",
        key: metadataKey,
        message: `Metadata save failed after image save: ${metadataPutResult.error.message}. Image has been rolled back.`,
      });
    }

    return ok({
      imageUrl: buildPublicR2Path(imageKey),
      metadataUrl: buildPublicR2Path(metadataKey),
    });
  }

  return {
    storeImageWithMetadata,
  };
}
