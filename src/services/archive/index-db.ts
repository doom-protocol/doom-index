import { and, or, lt, eq, desc, sql } from "drizzle-orm";
import { err, ok, Result } from "neverthrow";
import { archiveItems } from "@/db/schema/archive";
import { getDB } from "@/db";
import type { ArchiveMetadata } from "@/types/archive";
import type { AppError } from "@/types/app-error";
import { logger } from "@/utils/logger";

export type ArchiveCursor = { ts: number; id: string };

/**
 * Encode cursor to base64 string
 */
export const encodeCursor = (c: ArchiveCursor): string => {
  return btoa(JSON.stringify(c));
};

/**
 * Decode cursor from base64 string
 */
export const decodeCursor = (s: string): ArchiveCursor => {
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

export type ArchiveIndexRow = {
  id: string;
  timestamp: string;
  minuteBucket: string;
  paramsHash: string;
  seed: string;
  imageUrl: string;
  fileSize: number;
  ts: number;
  mcRoundedJson: string;
  visualParamsJson: string;
  prompt: string;
  negative: string;
};

/**
 * List archive items with keyset pagination (DESC order by ts, id)
 */
export async function listArchive(
  d1Binding: D1Database | undefined,
  options: {
    limit: number;
    cursor?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<
  Result<
    {
      items: ArchiveIndexRow[];
      cursor?: string;
      hasMore: boolean;
    },
    AppError
  >
> {
  try {
    const db = await getDB(d1Binding);
    const { limit, cursor, startDate, endDate } = options;
    const { startTs, endExclusiveTs } = toRangeTs(startDate, endDate);

    const whereParts = [];
    if (typeof startTs === "number") {
      whereParts.push(sql`${archiveItems.ts} >= ${startTs}`);
    }
    if (typeof endExclusiveTs === "number") {
      whereParts.push(sql`${archiveItems.ts} < ${endExclusiveTs}`);
    }

    if (cursor) {
      const c = decodeCursor(cursor);
      whereParts.push(or(lt(archiveItems.ts, c.ts), and(eq(archiveItems.ts, c.ts), lt(archiveItems.id, c.id))));
    }

    const rows = await db
      .select({
        id: archiveItems.id,
        timestamp: archiveItems.timestamp,
        minuteBucket: archiveItems.minuteBucket,
        paramsHash: archiveItems.paramsHash,
        seed: archiveItems.seed,
        imageUrl: archiveItems.imageUrl,
        fileSize: archiveItems.fileSize,
        ts: archiveItems.ts,
        mcRoundedJson: archiveItems.mcRoundedJson,
        visualParamsJson: archiveItems.visualParamsJson,
        prompt: archiveItems.prompt,
        negative: archiveItems.negative,
      })
      .from(archiveItems)
      .where(whereParts.length ? and(...whereParts) : undefined)
      .orderBy(desc(archiveItems.ts), desc(archiveItems.id))
      .limit(limit)
      .all();

    const nextCursor =
      rows.length > 0 ? encodeCursor({ ts: rows[rows.length - 1].ts, id: rows[rows.length - 1].id }) : undefined;

    logger.debug("archive.index-db.list", {
      limit,
      cursor: cursor || "none",
      startDate: startDate || "none",
      endDate: endDate || "none",
      itemsCount: rows.length,
      hasMore: !!nextCursor && rows.length === limit,
    });

    return ok({
      items: rows,
      cursor: nextCursor,
      hasMore: !!nextCursor && rows.length === limit,
    });
  } catch (error) {
    logger.error("archive.index-db.list.error", { error });
    return err({
      type: "StorageError" as const,
      op: "list" as const,
      key: "archive_items",
      message: `D1 list failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Insert archive item from metadata (idempotent)
 */
export async function insertArchiveItem(
  d1Binding: D1Database | undefined,
  metadata: ArchiveMetadata,
  r2Key: string,
): Promise<Result<void, AppError>> {
  try {
    const db = await getDB(d1Binding);
    const ts = Math.floor(new Date(metadata.timestamp).getTime() / 1000);

    await db
      .insert(archiveItems)
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
        mcRoundedJson: JSON.stringify(metadata.mcRounded),
        visualParamsJson: JSON.stringify(metadata.visualParams),
        prompt: metadata.prompt,
        negative: metadata.negative,
      })
      .onConflictDoNothing(); // id is PK, safe for idempotency

    logger.debug("archive.index-db.insert", { id: metadata.id, r2Key });

    return ok(undefined);
  } catch (error) {
    logger.error("archive.index-db.insert.error", { error, id: metadata.id });
    return err({
      type: "StorageError" as const,
      op: "put" as const,
      key: metadata.id,
      message: `D1 insert failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}

/**
 * Get archive item by ID with full metadata
 */
export async function getArchiveItemById(
  d1Binding: D1Database | undefined,
  id: string,
): Promise<Result<ArchiveMetadata | null, AppError>> {
  try {
    const db = await getDB(d1Binding);

    const row = await db.select().from(archiveItems).where(eq(archiveItems.id, id)).get();

    if (!row) {
      return ok(null);
    }

    const metadata: ArchiveMetadata = {
      id: row.id,
      timestamp: row.timestamp,
      minuteBucket: row.minuteBucket,
      paramsHash: row.paramsHash,
      seed: row.seed,
      mcRounded: JSON.parse(row.mcRoundedJson),
      visualParams: JSON.parse(row.visualParamsJson),
      imageUrl: row.imageUrl,
      fileSize: row.fileSize,
      prompt: row.prompt,
      negative: row.negative,
    };

    logger.debug("archive.index-db.get", { id, found: true });

    return ok(metadata);
  } catch (error) {
    logger.error("archive.index-db.get.error", { error, id });
    return err({
      type: "StorageError" as const,
      op: "get" as const,
      key: id,
      message: `D1 get failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
}
