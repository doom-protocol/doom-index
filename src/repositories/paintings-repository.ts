import { and, or, lt, gt, eq, desc, asc, sql } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { paintings } from "@/db/schema/paintings";
import { getDB } from "@/db";
import type { PaintingMetadata } from "@/types/paintings";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

export type PaintingCursor = { ts: number; id: string };

/**
 * Encode cursor to base64 string
 */
export const encodeCursor = (c: PaintingCursor): string => {
  return btoa(JSON.stringify(c));
};

/**
 * Decode cursor from base64 string
 */
export const decodeCursor = (s: string): PaintingCursor => {
  return JSON.parse(atob(s));
};

/**
 * Convert date strings to epoch timestamp range
 * Start date is inclusive, end date is exclusive (next day 00:00:00Z)
 */
function toRangeTs(startDate?: string, endDate?: string) {
  const startTs = startDate ? Math.floor(new Date(`${startDate}T00:00:00Z`).getTime() / 1000) : undefined;
  const endExclusiveTs = endDate
    ? Math.floor(new Date(new Date(`${endDate}T00:00:00Z`).getTime() + 86400_000).getTime() / 1000)
    : undefined;
  return { startTs, endExclusiveTs };
}

type ArchiveIndexRow = {
  id: string;
  timestamp: string;
  minuteBucket: string;
  paramsHash: string;
  seed: string;
  imageUrl: string;
  fileSize: number;
  ts: number;
  visualParamsJson: string;
  prompt: string;
  negative: string;
};

/**
 * Sort direction for archive queries
 * - "desc": Newest first (default, backward compatible)
 * - "asc": Oldest first
 */
export type ArchiveSortDirection = "asc" | "desc";

/**
 * Archive query options with flexible pagination support
 * Designed to support future extensions like token-based timeline queries
 */
export type ListArchiveOptions = {
  limit: number;
  cursor?: string;
  offset?: number;
  startDate?: string;
  endDate?: string;
  /**
   * Sort direction: "desc" for newest first (default), "asc" for oldest first
   * @default "desc"
   */
  direction?: ArchiveSortDirection;
  /**
   * Optional metadata filters for future use
   * Currently reserved for token timeline queries
   */
  paramsHash?: string;
  seed?: string;
};

/**
 * Archive query result with bidirectional cursor support
 */
export type ListArchiveResult = {
  items: ArchiveIndexRow[];
  /**
   * Cursor for next page (forward pagination)
   */
  cursor?: string;
  /**
   * Cursor for previous page (backward pagination)
   * Only available when direction is "desc" and items are returned
   */
  prevCursor?: string;
  hasMore: boolean;
};

/**
 * Paintings repository interface
 */
export interface PaintingsRepository {
  list(options: ListArchiveOptions): Promise<Result<ListArchiveResult, AppError>>;
  insert(metadata: PaintingMetadata, r2Key: string): Promise<Result<void, AppError>>;
  findById(id: string): Promise<Result<PaintingMetadata | null, AppError>>;
}

type CreatePaintingsRepositoryDeps = {
  d1Binding?: D1Database;
  log?: typeof logger;
};

/**
 * Create paintings repository
 *
 * @param deps - Dependencies including D1 binding
 * @returns Paintings repository instance
 */
export function createPaintingsRepository({
  d1Binding,
  log = logger,
}: CreatePaintingsRepositoryDeps = {}): PaintingsRepository {
  async function list(options: ListArchiveOptions): Promise<Result<ListArchiveResult, AppError>> {
    try {
      const db = await getDB(d1Binding);
      const { limit, cursor, offset, startDate, endDate, direction = "desc", paramsHash, seed } = options;
      const { startTs, endExclusiveTs } = toRangeTs(startDate, endDate);

      // Validate and clamp limit
      const clampedLimit = Math.min(Math.max(limit, 1), 100);

      const whereParts = [];
      if (typeof startTs === "number") {
        whereParts.push(sql`${paintings.ts} >= ${startTs}`);
      }
      if (typeof endExclusiveTs === "number") {
        whereParts.push(sql`${paintings.ts} < ${endExclusiveTs}`);
      }

      // Optional metadata filters (for future token timeline queries)
      if (paramsHash) {
        whereParts.push(eq(paintings.paramsHash, paramsHash));
      }
      if (seed) {
        whereParts.push(eq(paintings.seed, seed));
      }

      // Cursor-based pagination: direction-aware comparison
      if (cursor) {
        const c = decodeCursor(cursor);
        if (direction === "desc") {
          // For DESC: get items before cursor (ts < cursor.ts OR (ts == cursor.ts AND id < cursor.id))
          whereParts.push(or(lt(paintings.ts, c.ts), and(eq(paintings.ts, c.ts), lt(paintings.id, c.id))));
        } else {
          // For ASC: get items after cursor (ts > cursor.ts OR (ts == cursor.ts AND id > cursor.id))
          whereParts.push(or(gt(paintings.ts, c.ts), and(eq(paintings.ts, c.ts), gt(paintings.id, c.id))));
        }
      }

      // Build orderBy clause based on direction
      const orderBy =
        direction === "desc" ? [desc(paintings.ts), desc(paintings.id)] : [asc(paintings.ts), asc(paintings.id)];

      const baseQuery = db
        .select({
          id: paintings.id,
          timestamp: paintings.timestamp,
          minuteBucket: paintings.minuteBucket,
          paramsHash: paintings.paramsHash,
          seed: paintings.seed,
          imageUrl: paintings.imageUrl,
          fileSize: paintings.fileSize,
          ts: paintings.ts,
          visualParamsJson: paintings.visualParamsJson,
          prompt: paintings.prompt,
          negative: paintings.negative,
        })
        .from(paintings)
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(...orderBy)
        .limit(clampedLimit + 1); // Fetch one extra to determine hasMore

      const query = offset !== undefined && offset > 0 ? baseQuery.offset(offset) : baseQuery;

      const rows = await query.all();

      // Determine if there are more items
      const hasMore = rows.length > clampedLimit;
      const items = hasMore ? rows.slice(0, clampedLimit) : rows;

      // Generate cursors
      let nextCursor: string | undefined;
      let prevCursor: string | undefined;

      if (items.length > 0) {
        if (direction === "desc") {
          // For DESC: next cursor is the last item (older items)
          nextCursor = encodeCursor({ ts: items[items.length - 1].ts, id: items[items.length - 1].id });
          // prev cursor is the first item (newer items) - for backward navigation
          prevCursor = encodeCursor({ ts: items[0].ts, id: items[0].id });
        } else {
          // For ASC: next cursor is the last item (newer items)
          nextCursor = encodeCursor({ ts: items[items.length - 1].ts, id: items[items.length - 1].id });
          // prev cursor is the first item (older items) - for backward navigation
          prevCursor = encodeCursor({ ts: items[0].ts, id: items[0].id });
        }
      }

      log.debug("archive-repo.list", {
        limit: clampedLimit,
        direction,
        cursor: cursor || "none",
        offset: offset || 0,
        startDate: startDate || "none",
        endDate: endDate || "none",
        paramsHash: paramsHash || "none",
        seed: seed || "none",
        itemsCount: items.length,
        hasMore,
        nextCursor: nextCursor || "none",
        prevCursor: prevCursor || "none",
      });

      return ok({
        items,
        cursor: nextCursor,
        prevCursor,
        hasMore,
      });
    } catch (error) {
      log.error("archive-repo.list.error", { error });
      return err({
        type: "StorageError" as const,
        op: "list" as const,
        key: "paintings",
        message: `D1 list failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  async function insert(metadata: PaintingMetadata, r2Key: string): Promise<Result<void, AppError>> {
    try {
      const db = await getDB(d1Binding);
      const ts = Math.floor(new Date(metadata.timestamp).getTime() / 1000);

      await db
        .insert(paintings)
        .values({
          id: metadata.id,
          ts,
          timestamp: metadata.timestamp,
          minuteBucket: metadata.minuteBucket,
          paramsHash: metadata.paramsHash,
          seed: metadata.seed,
          r2Key,
          imageUrl: metadata.imageUrl,
          fileSize: metadata.fileSize,
          visualParamsJson: JSON.stringify(metadata.visualParams),
          prompt: metadata.prompt,
          negative: metadata.negative,
        })
        .onConflictDoNothing(); // id is PK, safe for idempotency

      log.debug("archive-repo.insert", { id: metadata.id, r2Key });

      return ok(undefined);
    } catch (error) {
      log.error("archive-repo.insert.error", { error, id: metadata.id });
      return err({
        type: "StorageError" as const,
        op: "put" as const,
        key: metadata.id,
        message: `D1 insert failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  async function findById(id: string): Promise<Result<PaintingMetadata | null, AppError>> {
    try {
      const db = await getDB(d1Binding);

      const row = await db.select().from(paintings).where(eq(paintings.id, id)).get();

      if (!row) {
        log.debug("archive-repo.find-by-id.not-found", { id });
        return ok(null);
      }

      const metadata: PaintingMetadata = {
        id: row.id,
        timestamp: row.timestamp,
        minuteBucket: row.minuteBucket,
        paramsHash: row.paramsHash,
        seed: row.seed,
        visualParams: JSON.parse(row.visualParamsJson),
        imageUrl: row.imageUrl,
        fileSize: row.fileSize,
        prompt: row.prompt,
        negative: row.negative,
      };

      log.debug("archive-repo.find-by-id.success", { id });

      return ok(metadata);
    } catch (error) {
      log.error("archive-repo.find-by-id.error", { error, id });
      return err({
        type: "StorageError" as const,
        op: "get" as const,
        key: id,
        message: `D1 get failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }

  return {
    list,
    insert,
    findById,
  };
}
