import { and, or, lt, eq, desc, sql } from "drizzle-orm";
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

export type ListArchiveOptions = {
  limit: number;
  cursor?: string;
  startDate?: string;
  endDate?: string;
};

export type ListArchiveResult = {
  items: ArchiveIndexRow[];
  cursor?: string;
  hasMore: boolean;
};

/**
 * Archive repository interface
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
 * Create archive repository
 *
 * @param deps - Dependencies including D1 binding
 * @returns Archive repository instance
 */
export function createPaintingsRepository({
  d1Binding,
  log = logger,
}: CreatePaintingsRepositoryDeps = {}): PaintingsRepository {
  async function list(options: ListArchiveOptions): Promise<Result<ListArchiveResult, AppError>> {
    try {
      const db = await getDB(d1Binding);
      const { limit, cursor, startDate, endDate } = options;
      const { startTs, endExclusiveTs } = toRangeTs(startDate, endDate);

      const whereParts = [];
      if (typeof startTs === "number") {
        whereParts.push(sql`${paintings.ts} >= ${startTs}`);
      }
      if (typeof endExclusiveTs === "number") {
        whereParts.push(sql`${paintings.ts} < ${endExclusiveTs}`);
      }

      if (cursor) {
        const c = decodeCursor(cursor);
        whereParts.push(or(lt(paintings.ts, c.ts), and(eq(paintings.ts, c.ts), lt(paintings.id, c.id))));
      }

      const rows = await db
        .select({
          id: paintings.id,
          timestamp: paintings.timestamp,
          minuteBucket: paintings.minuteBucket,
          paramsHash: paintings.paramsHash,
          seed: paintings.seed,
          imageUrl: paintings.imageUrl,
          fileSize: paintings.fileSize,
          ts: paintings.ts,
          mcRoundedJson: paintings.mcRoundedJson,
          visualParamsJson: paintings.visualParamsJson,
          prompt: paintings.prompt,
          negative: paintings.negative,
        })
        .from(paintings)
        .where(whereParts.length ? and(...whereParts) : undefined)
        .orderBy(desc(paintings.ts), desc(paintings.id))
        .limit(limit)
        .all();

      const nextCursor =
        rows.length > 0 ? encodeCursor({ ts: rows[rows.length - 1].ts, id: rows[rows.length - 1].id }) : undefined;

      log.debug("archive-repo.list", {
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
          mcRoundedJson: JSON.stringify(metadata.mcRounded),
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
        mcRounded: JSON.parse(row.mcRoundedJson),
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
