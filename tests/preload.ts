import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as dbSchema from "@/server/db/schema";

type CloudflareTestGlobal = typeof globalThis & {
  __DOOM_INDEX_CLOUDFLARE_ENV__?: CloudflareEnv;
};

// Create in-memory SQLite database for D1 tests
let testD1Db: BunSQLiteDatabase<typeof dbSchema> & {
  batch?: (operations: unknown[]) => Promise<unknown[]>;
};

function runStatements(sqlite: Database, statements: string[]): void {
  for (const statement of statements) {
    sqlite.run(statement);
  }
}

beforeEach(() => {
  // Create fresh in-memory database for each test
  const sqlite = new Database(":memory:");

  // Create tables
  runStatements(sqlite, [
    `CREATE TABLE paintings (
      id TEXT PRIMARY KEY NOT NULL,
      ts INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      minute_bucket TEXT NOT NULL,
      params_hash TEXT NOT NULL,
      seed TEXT NOT NULL,
      image_tx_id TEXT NOT NULL,
      glb_tx_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      glb_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      visual_params_json TEXT NOT NULL,
      prompt TEXT NOT NULL,
      negative TEXT NOT NULL
    )`,
    "CREATE INDEX idx_paintings_ts_id ON paintings(ts, id)",
    "CREATE INDEX idx_paintings_ts ON paintings(ts)",
    "CREATE INDEX idx_paintings_params_hash ON paintings(params_hash)",
    "CREATE INDEX idx_paintings_seed ON paintings(seed)",
    "CREATE UNIQUE INDEX idx_paintings_image_tx_id ON paintings(image_tx_id)",
    "CREATE UNIQUE INDEX idx_paintings_glb_tx_id ON paintings(glb_tx_id)",
  ]);

  runStatements(sqlite, [
    `CREATE TABLE market_snapshots (
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
    )`,
    "CREATE INDEX idx_market_snapshots_created_at ON market_snapshots(created_at)",
  ]);

  runStatements(sqlite, [
    `CREATE TABLE tokens (
      id TEXT PRIMARY KEY NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      logo_url TEXT,
      price_usd REAL NOT NULL,
      price_change_24h REAL NOT NULL,
      price_change_7d REAL,
      volume_24h_usd REAL,
      market_cap_usd REAL,
      categories TEXT,
      source TEXT NOT NULL,
      scores TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    "CREATE INDEX idx_tokens_symbol ON tokens(symbol)",
    "CREATE INDEX idx_tokens_created_at ON tokens(created_at)",
    "CREATE INDEX idx_tokens_updated_at ON tokens(updated_at)",
  ]);

  // Create Drizzle instance
  testD1Db = drizzle(sqlite, { schema: dbSchema });

  // Add batch method for compatibility with D1 interface
  testD1Db.batch = async (operations: unknown[]) => {
    const results = [];
    for (const op of operations) {
      const operation = op as {
        execute?: () => Promise<unknown>;
        all?: () => Promise<unknown>;
        values?: () => Promise<unknown>;
      };
      if (operation.execute) {
        results.push(await operation.execute());
      } else if (operation.all) {
        results.push(await operation.all());
      } else if (operation.values) {
        results.push(await operation.values());
      } else {
        results.push(await (op as Promise<unknown>));
      }
    }
    return results;
  };

  (globalThis as CloudflareTestGlobal).__DOOM_INDEX_CLOUDFLARE_ENV__ = {
    DB: testD1Db as unknown as D1Database,
    ASSETS: {} as Fetcher,
    VIEWER_KV: {} as KVNamespace,
    AI: {} as Ai,
  } as CloudflareEnv;
});

// Register happy-dom globals
GlobalRegistrator.register();

// Extend expect with @testing-library/jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Note: In-memory SQLite databases are automatically cleaned up when
  // they go out of scope. A new database is created in beforeEach.
});
