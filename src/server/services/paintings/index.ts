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

import { resolveBucketOrThrow } from "@/lib/r2";
import type { PaintingsRepository } from "@/server/repositories/paintings-repository";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import type { AppError } from "@/types/app-error";
import type { ArchiveListResponse } from "@/types/archive-list-response";
import type { PaginationOptions } from "@/types/domain";
import type { PaintingMetadata } from "@/types/paintings";
import type { Result } from "neverthrow";
import * as list from "./list";
import * as storage from "./storage";

interface PaintingsServiceDeps {
  r2Bucket?: R2Bucket;
  d1Binding?: D1Database;
  archiveRepository?: PaintingsRepository;
}

interface ArchiveStorageResult {
  imageUrl: string;
  metadataUrl: string;
}

type ArchiveListOptions = PaginationOptions & {
  prefix?: string;
  startAfter?: string;
};

export interface PaintingsService {
  /**
   * Store image and metadata atomically to R2
   * If metadata save fails, image save is rolled back
   */
  storeImageWithMetadata: (
    minuteBucket: string,
    filename: string,
    imageBuffer: ArrayBuffer,
    metadata: PaintingMetadata,
  ) => Promise<Result<ArchiveStorageResult, AppError>>;

  /**
   * List images from archive with pagination
   * Uses D1 for efficient listing, falls back to R2 if needed
   */
  listImages: (options: ArchiveListOptions) => Promise<Result<ArchiveListResponse, AppError>>;

  /**
   * Insert archive item metadata into D1 index (idempotent)
   */
  insertPainting: (metadata: PaintingMetadata, r2Key: string) => Promise<Result<void, AppError>>;

  /**
   * Get archive item by ID from D1 index
   */
  getPaintingById: (id: string) => Promise<Result<PaintingMetadata | null, AppError>>;
}

/**
 * Create archive service with unified interface
 *
 * @param r2Bucket - Optional R2 bucket. If not provided, resolves from Cloudflare context
 * @param d1Binding - Optional D1 database binding. If not provided, resolves from Cloudflare context
 * @param archiveRepository - Optional archive repository. If not provided, creates a new one
 */
export function createPaintingsService({
  r2Bucket,
  d1Binding,
  archiveRepository,
}: PaintingsServiceDeps = {}): PaintingsService {
  const bucket = resolveBucketOrThrow({ r2Bucket });
  const repo = archiveRepository ?? createPaintingsRepository({ d1Binding });

  return {
    storeImageWithMetadata: async (minuteBucket, filename, imageBuffer, metadata) =>
      storage.storeImageWithMetadata(bucket, minuteBucket, filename, imageBuffer, metadata),

    listImages: async (options) => list.listImages(bucket, d1Binding, options, repo),

    insertPainting: async (metadata, r2Key) => repo.insert(metadata, r2Key),

    getPaintingById: async (id) => repo.findById(id),
  };
}
