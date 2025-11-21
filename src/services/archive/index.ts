/**
 * Archive Service
 *
 * Unified service for managing archive operations:
 * - Storage: Save images and metadata to R2
 * - Indexing: Manage D1 database index
 * - Listing: Query and retrieve archive items
 *
 * This service provides a single interface for all archive-related operations,
 * abstracting away the complexity of coordinating R2 and D1 storage.
 */

import { Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import type { ArchiveMetadata } from "@/types/archive";
import { resolveBucketOrThrow } from "@/lib/r2";
import * as storage from "./storage";
import * as indexDb from "./index-db";
import * as list from "./list";

export type ArchiveServiceDeps = {
  r2Bucket?: R2Bucket;
  d1Binding?: D1Database;
};

export type ArchiveStorageResult = {
  imageUrl: string;
  metadataUrl: string;
};

export type ArchiveListOptions = {
  limit?: number;
  cursor?: string;
  prefix?: string;
  startAfter?: string;
  startDate?: string;
  endDate?: string;
};

export type ArchiveListResponse = list.ListImagesResponse;

export type ArchiveService = {
  /**
   * Store image and metadata atomically to R2
   * If metadata save fails, image save is rolled back
   */
  storeImageWithMetadata(
    minuteBucket: string,
    filename: string,
    imageBuffer: ArrayBuffer,
    metadata: ArchiveMetadata,
  ): Promise<Result<ArchiveStorageResult, AppError>>;

  /**
   * List images from archive with pagination
   * Uses D1 for efficient listing, falls back to R2 if needed
   */
  listImages(options: ArchiveListOptions): Promise<Result<ArchiveListResponse, AppError>>;

  /**
   * Insert archive item metadata into D1 index (idempotent)
   */
  insertArchiveItem(metadata: ArchiveMetadata, r2Key: string): Promise<Result<void, AppError>>;

  /**
   * Get archive item by ID from D1 index
   */
  getArchiveItemById(id: string): Promise<Result<ArchiveMetadata | null, AppError>>;
};

/**
 * Create archive service with unified interface
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 * @param d1Binding - Optional D1 database binding. If not provided, resolves from Cloudflare context
 */
export function createArchiveService({ r2Bucket, d1Binding }: ArchiveServiceDeps = {}): ArchiveService {
  const bucket = resolveBucketOrThrow({ r2Bucket });

  return {
    storeImageWithMetadata: (minuteBucket, filename, imageBuffer, metadata) =>
      storage.storeImageWithMetadata(bucket, minuteBucket, filename, imageBuffer, metadata),

    listImages: options => list.listImages(bucket, d1Binding, options),

    insertArchiveItem: (metadata, r2Key) => indexDb.insertArchiveItem(d1Binding, metadata, r2Key),

    getArchiveItemById: id => indexDb.getArchiveItemById(d1Binding, id),
  };
}

// Re-export types for convenience
export type { ArchiveCursor } from "./index-db";
export { encodeCursor, decodeCursor } from "./index-db";

// Legacy exports for backward compatibility (deprecated)
/** @deprecated Use createArchiveService instead */
export { createArchiveService as createArchiveStorageService };
/** @deprecated Use createArchiveService instead */
export { createArchiveService as createArchiveIndexService };
/** @deprecated Use createArchiveService instead */
export { createArchiveService as createArchiveListService };

// Legacy type exports (deprecated)
/** @deprecated Import from @/services/archive instead */
export type ArchiveStorageService = Pick<ArchiveService, "storeImageWithMetadata">;
/** @deprecated Import from @/services/archive instead */
export type ArchiveIndexService = Pick<ArchiveService, "insertArchiveItem" | "getArchiveItemById">;
/** @deprecated Import from @/services/archive instead */
export type ArchiveListService = Pick<ArchiveService, "listImages">;
