/**
 * Archive Service
 *
 * Unified service for managing archive operations:
 * - Storage: Save generated image / GLB bundles to Arweave
 * - Indexing: Manage D1 database index
 * - Listing: Query and retrieve archive items
 *
 * This service provides a single interface for all archive-related operations,
 * abstracting away the complexity of coordinating Arweave uploads and D1 indexing.
 */

import type { InsertPaintingRecord, PaintingsRepository } from "@/server/repositories/paintings-repository";
import { createPaintingsRepository } from "@/server/repositories/paintings-repository";
import type { AppError } from "@/types/app-error";
import type { ArchiveListResponse } from "@/types/archive-list-response";
import type { PaginationOptions } from "@/types/domain";
import type { PaintingMetadata } from "@/types/paintings";
import type { Result } from "neverthrow";
import * as list from "./list";
import * as storage from "./storage";

interface PaintingsServiceDeps {
  assetsFetcher?: Fetcher;
  d1Binding?: D1Database;
  archiveRepository?: PaintingsRepository;
}

type ArchiveListOptions = PaginationOptions & {
  offset?: number;
};

export interface PaintingsService {
  /**
   * Store generated image / GLB assets to Arweave
   */
  storePaintingAssets: (params: { imageBuffer: ArrayBuffer; imageContentType?: string; paintingId: string }) => Promise<
    Result<
      {
        imageTxId: string;
        imageUrl: string;
      },
      AppError
    >
  >;

  /**
   * List images from archive with pagination
   */
  listImages: (options: ArchiveListOptions) => Promise<Result<ArchiveListResponse, AppError>>;

  /**
   * Insert archive item metadata into D1 index (idempotent)
   */
  insertPainting: (record: InsertPaintingRecord) => Promise<Result<void, AppError>>;

  /**
   * Get archive item by ID from D1 index
   */
  getPaintingById: (id: string) => Promise<Result<PaintingMetadata | null, AppError>>;
}

/**
 * Create archive service with unified interface
 *
 * @param d1Binding - Optional D1 database binding. If not provided, resolves from Cloudflare context
 * @param archiveRepository - Optional archive repository. If not provided, creates a new one
 */
export function createPaintingsService({
  assetsFetcher,
  d1Binding,
  archiveRepository,
}: PaintingsServiceDeps = {}): PaintingsService {
  const repo = archiveRepository ?? createPaintingsRepository({ d1Binding });

  return {
    storePaintingAssets: async (params) =>
      storage.storePaintingAssets({
        assetsFetcher,
        imageBuffer: params.imageBuffer,
        imageContentType: params.imageContentType,
        paintingId: params.paintingId,
      }),

    listImages: async (options) => list.listImages(d1Binding, options, repo),

    insertPainting: async (record) => repo.insert(record),

    getPaintingById: async (id) => repo.findById(id),
  };
}
