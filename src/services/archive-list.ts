import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { resolveR2Bucket, getJsonR2 } from "@/lib/r2";
import type { ArchiveItem, ArchiveMetadata } from "@/types/archive";
import {
  isValidArchiveFilename,
  parseDatePrefix,
  isArchiveMetadata,
  buildPublicR2Path,
  extractIdFromFilename,
} from "@/lib/pure/archive";
import { logger } from "@/utils/logger";

type ArchiveListServiceDeps = {
  r2Bucket?: R2Bucket;
};

export type ArchiveListOptions = {
  limit?: number;
  cursor?: string;
  prefix?: string;
  startAfter?: string;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
};

export type ArchiveListResponse = {
  items: ArchiveItem[];
  cursor?: string;
  hasMore: boolean;
};

export type ArchiveListService = {
  /**
   * List images from R2 storage with pagination
   */
  listImages(options: ArchiveListOptions): Promise<Result<ArchiveListResponse, AppError>>;
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Filter R2 objects to only include valid .webp archive files
 */
function filterWebpObjects(objects: R2Object[]): R2Object[] {
  return objects.filter(obj => {
    const filename = obj.key.split("/").pop() || "";
    return filename.endsWith(".webp") && isValidArchiveFilename(filename);
  });
}

/**
 * Apply limit and build pagination response
 */
function buildPaginatedResponse(
  items: ArchiveItem[],
  limit: number,
  r2Truncated: boolean,
): ArchiveListResponse {
  const limitedItems = items.slice(0, limit);
  const hasMore = items.length > limit || r2Truncated;
  const cursor = hasMore && limitedItems.length > 0 ? limitedItems[limitedItems.length - 1]?.id : undefined;

  return {
    items: limitedItems,
    cursor,
    hasMore,
  };
}

/**
 * Build ArchiveItem array from R2Object array with metadata loading
 */
async function buildArchiveItemsWithMetadata(webpObjects: R2Object[], bucket: R2Bucket): Promise<ArchiveItem[]> {
  const metadataPromises = webpObjects.map(async obj => {
    const metadataKey = obj.key.replace(/\.webp$/, ".json");
    const metadataResult = await getJsonR2<ArchiveMetadata>(bucket, metadataKey);

    if (metadataResult.isErr()) {
      logger.warn("archive.metadata.load.failed", {
        imageKey: obj.key,
        metadataKey,
        error: metadataResult.error.message,
      });
      return { obj, metadata: null };
    }

    const metadata = metadataResult.value;
    if (!metadata || !isArchiveMetadata(metadata)) {
      logger.warn("archive.metadata.invalid", {
        imageKey: obj.key,
        metadataKey,
      });
      return { obj, metadata: null };
    }

    return { obj, metadata };
  });

  const metadataResults = await Promise.allSettled(metadataPromises);
  const items: ArchiveItem[] = [];

  for (const result of metadataResults) {
    if (result.status === "rejected") {
      logger.error("archive.metadata.load.error", {
        error: result.reason,
      });
      continue;
    }

    const { obj, metadata } = result.value;

    if (!metadata) {
      continue;
    }

    const imageUrl = buildPublicR2Path(obj.key);
    logger.debug("archive.item.built", {
      itemId: metadata.id,
      r2Key: obj.key,
      imageUrl,
      fileSize: obj.size ?? metadata.fileSize,
    });

    const item: ArchiveItem = {
      ...metadata,
      imageUrl,
      fileSize: obj.size ?? metadata.fileSize,
    };

    items.push(item);
  }

  return items.sort((a, b) => {
    const timestampA = a.timestamp || "";
    const timestampB = b.timestamp || "";
    return timestampB.localeCompare(timestampA); // Descending order
  });
}

/**
 * Create archive list service for R2 list operations
 */
export function createArchiveListService({ r2Bucket }: ArchiveListServiceDeps = {}): ArchiveListService {
  let bucket: R2Bucket;
  if (r2Bucket) {
    bucket = r2Bucket;
  } else {
    const bucketResult = resolveR2Bucket();
    if (bucketResult.isErr()) {
      throw new Error(`Failed to resolve R2 bucket: ${bucketResult.error.message}`);
    }
    bucket = bucketResult.value;
  }

  /**
   * Generate date prefixes for a date range
   */
  function generateDatePrefixes(startDate: string, endDate: string): string[] {
    const prefixes: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

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
   * Calculate startAfter key for endDate filtering
   * Returns a key that would come after all items on the endDate
   */
  function calculateStartAfterForEndDate(endDate: string): string {
    const date = new Date(endDate);
    date.setDate(date.getDate() + 1); // Next day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `images/${year}/${month}/${day}/`;
  }

  async function listImages(options: ArchiveListOptions): Promise<Result<ArchiveListResponse, AppError>> {
    try {
      const limit = Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

      if (options.startDate && options.endDate) {
        const datePrefixes = generateDatePrefixes(options.startDate, options.endDate);

        const listPromises = datePrefixes.map(async prefix => {
          const listOptions: R2ListOptions = {
            limit: limit * datePrefixes.length,
            prefix,
          };

          if (options.cursor) {
            listOptions.cursor = options.cursor;
          }

          return bucket.list(listOptions);
        });

        const listResults = await Promise.all(listPromises);
        const allObjects = listResults.flatMap(result => result.objects);
        const webpObjects = filterWebpObjects(allObjects);

        const endDateStartAfter = calculateStartAfterForEndDate(options.endDate);
        const filteredObjects = webpObjects.filter(obj => obj.key < endDateStartAfter);

        const items = await buildArchiveItemsWithMetadata(filteredObjects, bucket);
        const response = buildPaginatedResponse(items, limit, false);

        return ok(response);
      }

      const r2ListLimit = limit * 2;
      const maxObjects = 1000;
      const collectedWebpObjects: R2Object[] = [];
      let totalR2Objects = 0;
      let totalWebpObjects = 0;
      let r2Cursor: string | undefined;
      let cursorFound = !options.cursor;
      let moreObjectsAvailable = false;

      do {
        const listOptions: R2ListOptions = {
          limit: r2ListLimit,
          prefix: options.prefix ?? "images/",
        };

        if (r2Cursor) {
          listOptions.cursor = r2Cursor;
        }

        if (options.startDate && !options.endDate) {
          try {
            const datePrefix = parseDatePrefix(options.startDate);
            listOptions.prefix = datePrefix.prefix;
          } catch (error) {
            return err({
              type: "ValidationError",
              message: `Invalid startDate format: ${error instanceof Error ? error.message : "Unknown error"}`,
            });
          }
        }

        const listResult = await bucket.list(listOptions);
        totalR2Objects += listResult.objects.length;
        const webpObjects = filterWebpObjects(listResult.objects);
        totalWebpObjects += webpObjects.length;

        if (options.cursor && !cursorFound) {
          // Determine if cursor is within this batch
          const cursorIndex = webpObjects.findIndex(obj => extractIdFromFilename(obj.key.split("/").pop() || "") === options.cursor);
          if (cursorIndex >= 0) {
            cursorFound = true;
            collectedWebpObjects.push(...webpObjects.slice(cursorIndex + 1));
          } else {
            collectedWebpObjects.push(...webpObjects);
          }
        } else {
          collectedWebpObjects.push(...webpObjects);
        }

        if (listResult.truncated && listResult.cursor) {
          r2Cursor = listResult.cursor;
          moreObjectsAvailable = true;
        } else {
          r2Cursor = undefined;
          moreObjectsAvailable = false;
        }

        // Stop if we have collected enough objects
        if (collectedWebpObjects.length >= maxObjects) {
          moreObjectsAvailable = true;
          break;
        }
      } while (r2Cursor);

      if (options.cursor && !cursorFound) {
        logger.warn("archive-list.cursor-not-found", {
          cursor: options.cursor,
        });
      }

      let items = await buildArchiveItemsWithMetadata(collectedWebpObjects, bucket);

      if (options.cursor) {
        const cursorIndex = items.findIndex(item => item.id === options.cursor);
        if (cursorIndex >= 0) {
          items = items.slice(cursorIndex + 1);
        } else {
          items = items.filter(item => item.id < options.cursor!);
        }
      }

      const response = buildPaginatedResponse(items, limit, moreObjectsAvailable || items.length > limit);

      logger.debug("archive-list.query-completed", {
        requestedLimit: limit,
        r2ObjectsCount: totalR2Objects,
        webpObjectsCount: totalWebpObjects,
        finalItemsCount: response.items.length,
        hasMore: response.hasMore,
      });

      return ok(response);
    } catch (error) {
      return err({
        type: "StorageError",
        op: "list",
        key: options.prefix ?? "images/",
        message: `R2 list failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  return {
    listImages,
  };
}
