import * as dbSchema from "@/db/schema";
import { marketSnapshots, type NewMarketSnapshot } from "@/db/schema/market-snapshots";
import { MarketSnapshotsRepository } from "@/repositories/market-snapshots-repository";
import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import type { BatchItem, BatchResponse } from "drizzle-orm/batch";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";

// Extended DB type with batch method for test compatibility
type TestDb = BunSQLiteDatabase<typeof dbSchema> & {
  batch<U extends BatchItem<"sqlite">, T extends Readonly<[U, ...U[]]>>(batch: T): Promise<BatchResponse<T>>;
};

describe("MarketSnapshotsRepository", () => {
  let db: TestDb;
  let repository: MarketSnapshotsRepository;

  beforeEach(() => {
    // Create in-memory SQLite database
    const sqlite = new Database(":memory:");

    // Create market_snapshots table
    sqlite.exec(`
      CREATE TABLE market_snapshots (
        hour_bucket TEXT PRIMARY KEY NOT NULL,
        total_market_cap_usd REAL NOT NULL,
        total_volume_usd REAL NOT NULL,
        market_cap_change_percentage_24h_usd REAL NOT NULL,
        btc_dominance REAL NOT NULL,
        eth_dominance REAL NOT NULL,
        active_cryptocurrencies INTEGER NOT NULL,
        markets INTEGER NOT NULL,
        fear_greed_index INTEGER,
        updated_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_market_snapshots_created_at ON market_snapshots(created_at);
    `);

    const baseDb = drizzle(sqlite, { schema: dbSchema });

    // Add batch method stub to match expected MarketSnapshotsDb interface
    // BunSQLiteDatabase doesn't have batch, but DrizzleD1Database does
    // The batch method receives query builder objects and should execute them sequentially
    db = Object.assign(baseDb, {
      batch: async <T extends readonly BatchItem<"sqlite">[]>(operations: T): Promise<BatchResponse<T>> => {
        // Simple sequential execution for test purposes
        // Each BatchItem is a query builder with methods like .execute(), .all(), etc.
        // For simplicity in tests, we return empty results since the repository
        // doesn't currently use batch operations
        const results = operations.map(() => ({}));
        return results as BatchResponse<T>;
      },
    }) as TestDb;

    repository = new MarketSnapshotsRepository(db);
  });

  describe("findByHourBucket", () => {
    it("should return null when snapshot does not exist", async () => {
      const result = await repository.findByHourBucket("2025-11-21T15");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeNull();
      }
    });

    it("should return snapshot when it exists", async () => {
      const now = Math.floor(Date.now() / 1000);
      const snapshot: NewMarketSnapshot = {
        hourBucket: "2025-11-21T15",
        totalMarketCapUsd: 2000000000000,
        totalVolumeUsd: 100000000000,
        marketCapChangePercentage24hUsd: 2.5,
        btcDominance: 50.0,
        ethDominance: 20.0,
        activeCryptocurrencies: 10000,
        markets: 500,
        fearGreedIndex: 50,
        updatedAt: now,
        createdAt: now,
      };

      await db.insert(marketSnapshots).values(snapshot);

      const result = await repository.findByHourBucket("2025-11-21T15");

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).not.toBeNull();
        expect(result.value?.hourBucket).toBe("2025-11-21T15");
        expect(result.value?.totalMarketCapUsd).toBe(2000000000000);
      }
    });
  });

  describe("upsert", () => {
    it("should insert new snapshot", async () => {
      const now = Math.floor(Date.now() / 1000);
      const snapshot: Omit<NewMarketSnapshot, "hourBucket"> = {
        totalMarketCapUsd: 2000000000000,
        totalVolumeUsd: 100000000000,
        marketCapChangePercentage24hUsd: 2.5,
        btcDominance: 50.0,
        ethDominance: 20.0,
        activeCryptocurrencies: 10000,
        markets: 500,
        fearGreedIndex: 50,
        updatedAt: now,
        createdAt: now,
      };

      const result = await repository.upsert("2025-11-21T15", snapshot);

      expect(result.isOk()).toBe(true);

      // Verify snapshot was inserted
      const findResult = await repository.findByHourBucket("2025-11-21T15");
      expect(findResult.isOk()).toBe(true);
      if (findResult.isOk()) {
        expect(findResult.value?.hourBucket).toBe("2025-11-21T15");
      }
    });

    it("should update existing snapshot on conflict", async () => {
      const now = Math.floor(Date.now() / 1000);
      const snapshot: Omit<NewMarketSnapshot, "hourBucket"> = {
        totalMarketCapUsd: 2000000000000,
        totalVolumeUsd: 100000000000,
        marketCapChangePercentage24hUsd: 2.5,
        btcDominance: 50.0,
        ethDominance: 20.0,
        activeCryptocurrencies: 10000,
        markets: 500,
        fearGreedIndex: 50,
        updatedAt: now,
        createdAt: now,
      };

      // Insert first time
      await repository.upsert("2025-11-21T15", snapshot);

      // Upsert again with updated data
      const updatedSnapshot: Omit<NewMarketSnapshot, "hourBucket"> = {
        ...snapshot,
        totalMarketCapUsd: 2100000000000,
        updatedAt: now + 1000,
      };
      const result = await repository.upsert("2025-11-21T15", updatedSnapshot);

      expect(result.isOk()).toBe(true);

      // Verify snapshot was updated
      const findResult = await repository.findByHourBucket("2025-11-21T15");
      expect(findResult.isOk()).toBe(true);
      if (findResult.isOk()) {
        expect(findResult.value?.totalMarketCapUsd).toBe(2100000000000);
        expect(findResult.value?.updatedAt).toBe(now + 1000);
      }
    });

    it("should handle null fearGreedIndex", async () => {
      const now = Math.floor(Date.now() / 1000);
      const snapshot: Omit<NewMarketSnapshot, "hourBucket"> = {
        totalMarketCapUsd: 2000000000000,
        totalVolumeUsd: 100000000000,
        marketCapChangePercentage24hUsd: 2.5,
        btcDominance: 50.0,
        ethDominance: 20.0,
        activeCryptocurrencies: 10000,
        markets: 500,
        fearGreedIndex: null,
        updatedAt: now,
        createdAt: now,
      };

      const result = await repository.upsert("2025-11-21T15", snapshot);

      expect(result.isOk()).toBe(true);

      // Verify snapshot was inserted with null fearGreedIndex
      const findResult = await repository.findByHourBucket("2025-11-21T15");
      expect(findResult.isOk()).toBe(true);
      if (findResult.isOk()) {
        expect(findResult.value?.fearGreedIndex).toBeNull();
      }
    });
  });
});
