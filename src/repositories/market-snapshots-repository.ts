import { Result, ok, err } from "neverthrow";
import { eq } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "@/db/schema";
import type { AppError } from "@/types/app-error";
import { marketSnapshots, type MarketSnapshot, type NewMarketSnapshot } from "@/db/schema/market-snapshots";
import { logger } from "@/utils/logger";

/**
 * Market Snapshots Repository
 * Handles CRUD operations for global market snapshots
 * Requirements: 3, 9, 10
 */
type MarketSnapshotsDb =
  | DrizzleD1Database<typeof schema>
  | BetterSQLite3Database<typeof schema>
  | BunSQLiteDatabase<typeof schema>;

export class MarketSnapshotsRepository {
  constructor(private readonly db: MarketSnapshotsDb) {}

  /**
   * Find snapshot by hourBucket (Requirement 10)
   */
  async findByHourBucket(hourBucket: string): Promise<Result<MarketSnapshot | null, AppError>> {
    try {
      logger.debug(`[MarketSnapshotsRepository] Finding snapshot by hourBucket: ${hourBucket}`);

      const result = await this.db
        .select()
        .from(marketSnapshots)
        .where(eq(marketSnapshots.hourBucket, hourBucket))
        .limit(1);

      if (result.length === 0) {
        logger.debug(`[MarketSnapshotsRepository] Snapshot not found: ${hourBucket}`);
        return ok(null);
      }

      logger.debug(`[MarketSnapshotsRepository] Found snapshot: ${hourBucket}`);
      return ok(result[0]);
    } catch (error) {
      logger.error(`[MarketSnapshotsRepository] Failed to find snapshot: ${hourBucket}`, { error });
      return err({
        type: "StorageError" as const,
        op: "get" as const,
        key: `market_snapshots/${hourBucket}`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Insert or update snapshot (Requirement 9)
   * Uses upsert to ensure idempotency
   */
  async upsert(hourBucket: string, snapshot: Omit<NewMarketSnapshot, "hourBucket">): Promise<Result<void, AppError>> {
    try {
      logger.debug(`[MarketSnapshotsRepository] Upserting snapshot: ${hourBucket}`);

      const data: NewMarketSnapshot = {
        hourBucket,
        ...snapshot,
      };

      await this.db
        .insert(marketSnapshots)
        .values(data)
        .onConflictDoUpdate({
          target: marketSnapshots.hourBucket,
          set: {
            totalMarketCapUsd: data.totalMarketCapUsd,
            totalVolumeUsd: data.totalVolumeUsd,
            marketCapChangePercentage24hUsd: data.marketCapChangePercentage24hUsd,
            btcDominance: data.btcDominance,
            ethDominance: data.ethDominance,
            activeCryptocurrencies: data.activeCryptocurrencies,
            markets: data.markets,
            fearGreedIndex: data.fearGreedIndex,
            updatedAt: data.updatedAt,
            createdAt: data.createdAt,
          },
        });

      logger.info(`[MarketSnapshotsRepository] Upserted snapshot: ${hourBucket}`);
      return ok(undefined);
    } catch (error) {
      logger.error(`[MarketSnapshotsRepository] Failed to upsert snapshot: ${hourBucket}`, { error });
      return err({
        type: "StorageError" as const,
        op: "put" as const,
        key: `market_snapshots/${hourBucket}`,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
}
