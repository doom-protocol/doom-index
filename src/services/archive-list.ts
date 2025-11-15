import { err, ok, Result } from "neverthrow";
import type { AppError } from "@/types/app-error";
import { resolveBucketOrThrow, getJsonR2, listR2Objects } from "@/lib/r2";
import type { ArchiveItem, ArchiveMetadata } from "@/types/archive";
import { isValidArchiveFilename, parseDatePrefix, isArchiveMetadata, buildPublicR2Path } from "@/lib/pure/archive";
import { logger } from "@/utils/logger";

type ArchiveListServiceDeps = {
  r2Bucket?: R2Bucket;
};

export type ArchiveListOptions = {
  limit?: number;
  /**
   * R2 object key to continue listing after (cursor returned from previous response).
   */
  cursor?: string;
  prefix?: string;
  /**
   * Explicit R2 object key to start after. Takes precedence over cursor when provided.
   */
  startAfter?: string;
  startDate?: string; // YYYY-MM-DD format
  endDate?: string; // YYYY-MM-DD format
};

export type ArchiveListResponse = {
  items: ArchiveItem[];
  /**
   * R2 object key for the last item in the current page.
   */
  cursor?: string;
  hasMore: boolean;
};

export type ArchiveListService = {
  /**
   * List images from R2 storage with pagination
   */
  listImages(options: ArchiveListOptions): Promise<Result<ArchiveListResponse, AppError>>;
};

type ArchiveItemWithKey = {
  key: string;
  item: ArchiveItem;
};

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
    return filename.endsWith(".webp") && isValidArchiveFilename(filename);
  });
}

type BuildMetadataOptions = {
  sortOrder?: "asc" | "desc";
};

/**
 * Build ArchiveItem array from R2Object array with metadata loading
 */
async function buildArchiveItemsWithMetadata(
  webpObjects: R2Object[],
  bucket: R2Bucket,
  options: BuildMetadataOptions = {},
): Promise<ArchiveItemWithKey[]> {
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
  const items: ArchiveItemWithKey[] = [];

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
  entries: ArchiveItemWithKey[];
  cursor?: string;
  hasMore: boolean;
};

async function collectPaginatedArchiveItems({
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
  const collected: ArchiveItemWithKey[] = [];
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
    const builtItems = await buildArchiveItemsWithMetadata(webpObjects, bucket);
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
 * Create archive list service for R2 list operations
 */
export function createArchiveListService({ r2Bucket }: ArchiveListServiceDeps = {}): ArchiveListService {
  const bucket = resolveBucketOrThrow({ r2Bucket });

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

        if (options.cursor) {
          logger.warn("archive-list.cursor-ignored-for-date-range", {
            cursor: options.cursor,
            startDate: options.startDate,
            endDate: options.endDate,
          });
        }

        const listResults = await Promise.all(datePrefixes.map(prefix => listR2Objects(bucket, { limit, prefix })));

        const failedResult = listResults.find(result => result.isErr());
        if (failedResult && failedResult.isErr()) {
          return err(failedResult.error);
        }

        const allObjects = listResults.flatMap(result => (result.isOk() ? result.value.objects : []));
        const webpObjects = filterWebpObjects(allObjects);

        const endDateStartAfter = calculateStartAfterForEndDate(options.endDate);
        const filteredObjects = webpObjects.filter(obj => obj.key < endDateStartAfter);

        const items = await buildArchiveItemsWithMetadata(filteredObjects, bucket, { sortOrder: "desc" });
        const limitedItems = items.slice(0, limit).map(entry => entry.item);
        // Date-range queries span multiple prefixes and currently do not support pagination.
        const response: ArchiveListResponse = {
          items: limitedItems,
          hasMore: false,
          cursor: undefined,
        };

        return ok(response);
      }

      let listPrefix = options.prefix ?? "images/";

      if (options.startDate && !options.endDate) {
        try {
          const datePrefix = parseDatePrefix(options.startDate);
          listPrefix = datePrefix.prefix;
        } catch (error) {
          return err({
            type: "ValidationError",
            message: `Invalid startDate format: ${error instanceof Error ? error.message : "Unknown error"}`,
          });
        }
      }

      const pageResult = await collectPaginatedArchiveItems({
        bucket,
        prefix: listPrefix,
        limit,
        startAfter: options.startAfter ?? options.cursor,
      });

      if (pageResult.isErr()) {
        return err(pageResult.error);
      }

      logger.debug("archive-list.query-completed", {
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

  return {
    listImages,
  };
}
