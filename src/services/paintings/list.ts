import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { getJsonR2, listR2Objects } from "@/lib/r2";
import type { Painting, PaintingMetadata } from "@/types/paintings";
import { isValidPaintingFilename, buildPublicR2Path } from "@/utils/paintings";
import { parseDatePrefix } from "@/lib/pure/painting-date";
import { isPaintingMetadata } from "@/lib/pure/painting-metadata";
import { logger } from "@/utils/logger";
import type { VisualParams } from "@/lib/pure/mapping";
import { createPaintingsRepository } from "@/repositories/paintings-repository";
import type { PaintingsRepository } from "@/repositories/paintings-repository";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const R2_MAX_LIST_LIMIT = 1000;
const R2_FETCH_MULTIPLIER = 2;

/**
 * Filter R2 objects to only include valid .webp archive files
 */
function filterWebpObjects(objects: R2Object[]): R2Object[] {
  return objects.filter(obj => {
    const filename = obj.key.split("/").pop() || "";
    return filename.endsWith(".webp") && isValidPaintingFilename(filename);
  });
}

type BuildMetadataOptions = {
  sortOrder?: "asc" | "desc";
};

/**
 * Build Painting array from R2Object array with metadata loading
 */
async function buildPaintingsWithMetadata(
  webpObjects: R2Object[],
  bucket: R2Bucket,
  options: BuildMetadataOptions = {},
): Promise<Array<{ key: string; item: Painting }>> {
  const metadataPromises = webpObjects.map(async obj => {
    const metadataKey = obj.key.replace(/\.webp$/, ".json");
    const metadataResult = await getJsonR2<PaintingMetadata>(bucket, metadataKey);

    if (metadataResult.isErr()) {
      logger.warn("archive.list.metadata.load.failed", {
        imageKey: obj.key,
        metadataKey,
        error: metadataResult.error.message,
      });
      return { obj, metadata: null };
    }

    const metadata = metadataResult.value;
    if (!metadata || !isPaintingMetadata(metadata)) {
      logger.warn("archive.list.metadata.invalid", {
        imageKey: obj.key,
        metadataKey,
      });
      return { obj, metadata: null };
    }

    return { obj, metadata };
  });

  const metadataResults = await Promise.allSettled(metadataPromises);
  const items: Array<{ key: string; item: Painting }> = [];

  for (const result of metadataResults) {
    if (result.status === "rejected") {
      logger.error("archive.list.metadata.load.error", {
        error: result.reason,
      });
      continue;
    }

    const { obj, metadata } = result.value;

    if (!metadata) {
      continue;
    }

    const imageUrl = buildPublicR2Path(obj.key);
    logger.debug("archive.list.item.built", {
      itemId: metadata.id,
      r2Key: obj.key,
      imageUrl,
      fileSize: obj.size ?? metadata.fileSize,
    });

    const item: Painting = {
      ...metadata,
      imageUrl,
      fileSize: obj.size ?? metadata.fileSize,
    };

    items.push({
      key: obj.key,
      item,
    });
  }

  if (!options.sortOrder) {
    return items;
  }

  return items.sort((a, b) => {
    const timestampA = a.item.timestamp || "";
    const timestampB = b.item.timestamp || "";
    return options.sortOrder === "desc" ? timestampB.localeCompare(timestampA) : timestampA.localeCompare(timestampB);
  });
}

type PaginatedCollectionResult = {
  entries: Array<{ key: string; item: Painting }>;
  cursor?: string;
  hasMore: boolean;
};

async function collectPaginatedPaintings({
  bucket,
  prefix,
  limit,
  startAfter,
}: {
  bucket: R2Bucket;
  prefix: string;
  limit: number;
  startAfter?: string;
}): Promise<Result<PaginatedCollectionResult, AppError>> {
  const collected: Array<{ key: string; item: Painting }> = [];
  let pendingStartAfter = startAfter;
  let continuationCursor: string | undefined;
  let sawAdditionalPages = false;

  while (collected.length < limit) {
    const remaining = limit - collected.length;
    const requestLimit = Math.min(Math.max(remaining * R2_FETCH_MULTIPLIER, remaining), R2_MAX_LIST_LIMIT);

    const listOptions = {
      prefix,
      limit: Math.max(requestLimit, 1),
      startAfter: pendingStartAfter,
      cursor: pendingStartAfter ? undefined : continuationCursor,
    };

    pendingStartAfter = undefined;

    const listResult = await listR2Objects(bucket, listOptions);
    if (listResult.isErr()) {
      return err(listResult.error);
    }

    const webpObjects = filterWebpObjects(listResult.value.objects);
    const builtItems = await buildPaintingsWithMetadata(webpObjects, bucket);
    collected.push(...builtItems);

    if (listResult.value.truncated && listResult.value.cursor) {
      continuationCursor = listResult.value.cursor;
      sawAdditionalPages = true;
    } else {
      continuationCursor = undefined;
      sawAdditionalPages = false;
      break;
    }
  }

  const limitedItems = collected.slice(0, limit);
  const extraItems = collected.length > limitedItems.length;
  const hasMore = limitedItems.length > 0 && (extraItems || sawAdditionalPages || Boolean(continuationCursor));
  const cursor = hasMore ? limitedItems[limitedItems.length - 1]?.key : undefined;

  return ok({
    entries: limitedItems,
    cursor,
    hasMore,
  });
}

/**
 * Generate date prefixes for a date range
 */
function generateDatePrefixes(from: string, to: string): string[] {
  const prefixes: string[] = [];
  const start = new Date(from);
  const end = new Date(to);

  // Iterate through each day in the range
  const current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const day = String(current.getDate()).padStart(2, "0");
    prefixes.push(`images/${year}/${month}/${day}/`);

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return prefixes;
}

/**
 * Calculate startAfter key for to filtering
 * Returns a key that would come after all items on the to
 */
function calculateStartAfterForto(to: string): string {
  const date = new Date(to);
  date.setDate(date.getDate() + 1); // Next day
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `images/${year}/${month}/${day}/`;
}

export type ListImagesOptions = {
  limit?: number;
  cursor?: string;
  offset?: number;
  prefix?: string;
  startAfter?: string;
  from?: string;
  to?: string;
};

export type ListImagesResponse = {
  items: Painting[];
  cursor?: string;
  hasMore: boolean;
};

/**
 * List images from archive with pagination
 * Uses D1 for efficient listing with DESC sorting
 * Falls back to R2 for date-range queries (temporary until D1 is fully populated)
 */
export async function listImages(
  bucket: R2Bucket,
  d1Binding: D1Database | undefined,
  options: ListImagesOptions,
  archiveRepository?: PaintingsRepository,
): Promise<Result<ListImagesResponse, AppError>> {
  try {
    const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const repo = archiveRepository ?? createPaintingsRepository({ d1Binding });

    const d1Result = await repo.list({
      limit,
      cursor: options.cursor,
      offset: options.offset,
      from: options.from,
      to: options.to,
    });

    if (d1Result.isOk()) {
      const d1Data = d1Result.value;

      const items: Painting[] = d1Data.items.map(item => {
        try {
          const visualParams = JSON.parse(item.visualParamsJson) as VisualParams;

          return {
            id: item.id,
            timestamp: item.timestamp,
            minuteBucket: item.minuteBucket,
            paramsHash: item.paramsHash,
            seed: item.seed,
            imageUrl: item.imageUrl,
            fileSize: item.fileSize,
            visualParams,
            prompt: item.prompt,
            negative: item.negative,
          };
        } catch (error) {
          logger.error("archive.list.d1-parse-error", {
            id: item.id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          // Fallback to empty values if JSON parsing fails
          return {
            id: item.id,
            timestamp: item.timestamp,
            minuteBucket: item.minuteBucket,
            paramsHash: item.paramsHash,
            seed: item.seed,
            imageUrl: item.imageUrl,
            fileSize: item.fileSize,
            visualParams: {} as VisualParams,
            prompt: item.prompt,
            negative: item.negative,
          };
        }
      });

      logger.debug("archive.list.d1-query-completed", {
        requestedLimit: limit,
        returnedItems: items.length,
        hasMore: d1Data.hasMore,
        cursor: options.cursor ?? "none",
        nextCursor: d1Data.cursor ?? "none",
      });

      return ok({
        items,
        cursor: d1Data.cursor,
        hasMore: d1Data.hasMore,
      });
    }

    logger.warn("archive.list.d1-fallback", { error: d1Result.error });

    if (options.from && options.to) {
      const datePrefixes = generateDatePrefixes(options.from, options.to);

      if (options.cursor) {
        logger.warn("archive.list.cursor-ignored-for-date-range", {
          cursor: options.cursor,
          from: options.from,
          to: options.to,
        });
      }

      const listResults = await Promise.all(datePrefixes.map(prefix => listR2Objects(bucket, { limit, prefix })));

      const failedResult = listResults.find(result => result.isErr());
      if (failedResult && failedResult.isErr()) {
        return err(failedResult.error);
      }

      const allObjects = listResults.flatMap(result => (result.isOk() ? result.value.objects : []));
      const webpObjects = filterWebpObjects(allObjects);

      const toStartAfter = calculateStartAfterForto(options.to);
      const filteredObjects = webpObjects.filter(obj => obj.key < toStartAfter);

      const items = await buildPaintingsWithMetadata(filteredObjects, bucket, { sortOrder: "desc" });
      const limitedItems = items.slice(0, limit).map(entry => entry.item);
      // Date-range queries span multiple prefixes and currently do not support pagination.
      const response: ListImagesResponse = {
        items: limitedItems,
        hasMore: false,
        cursor: undefined,
      };

      return ok(response);
    }

    let listPrefix = options.prefix ?? "images/";

    if (options.from && !options.to) {
      try {
        const datePrefix = parseDatePrefix(options.from);
        listPrefix = datePrefix.prefix;
      } catch (error) {
        return err({
          type: "ValidationError",
          message: `Invalid from format: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }
    }

    const pageResult = await collectPaginatedPaintings({
      bucket,
      prefix: listPrefix,
      limit,
      startAfter: options.startAfter ?? options.cursor,
    });

    if (pageResult.isErr()) {
      return err(pageResult.error);
    }

    logger.debug("archive.list.query-completed", {
      requestedLimit: limit,
      returnedItems: pageResult.value.entries.length,
      hasMore: pageResult.value.hasMore,
      prefix: listPrefix,
      providedCursor: options.cursor ?? "none",
      providedStartAfter: options.startAfter ?? "none",
      nextCursor: pageResult.value.cursor ?? "none",
    });

    return ok({
      items: pageResult.value.entries.map(entry => entry.item),
      cursor: pageResult.value.cursor,
      hasMore: pageResult.value.hasMore,
    });
  } catch (error) {
    return err({
      type: "StorageError",
      op: "list",
      key: options.prefix ?? "images/",
      message: `R2 list failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
