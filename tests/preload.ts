import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, mock } from "bun:test";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as dbSchema from "@/db/schema";

// Note: NEXT_PUBLIC_R2_URL is handled by individual tests that mock @/env

// Create in-memory SQLite database for D1 tests
let testD1Db: any;

beforeEach(() => {
  // Create fresh in-memory database for each test
  const sqlite = new Database(":memory:");

  // Create tables
  sqlite.exec(`
    CREATE TABLE paintings (
      id TEXT PRIMARY KEY NOT NULL,
      timestamp TEXT NOT NULL,
      minute_bucket TEXT NOT NULL,
      params_hash TEXT NOT NULL,
      seed TEXT NOT NULL,
      visual_params TEXT NOT NULL,
      image_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      negative TEXT,
      r2_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_paintings_minute_bucket ON paintings(minute_bucket);
    CREATE INDEX idx_paintings_timestamp ON paintings(timestamp);
    CREATE INDEX idx_paintings_created_at ON paintings(created_at);
  `);

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

  sqlite.exec(`
    CREATE TABLE tokens (
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
    );
    CREATE INDEX idx_tokens_symbol ON tokens(symbol);
    CREATE INDEX idx_tokens_created_at ON tokens(created_at);
    CREATE INDEX idx_tokens_updated_at ON tokens(updated_at);
  `);

  // Create Drizzle instance
  testD1Db = drizzle(sqlite, { schema: dbSchema });

  // Add batch method for compatibility with D1 interface
  testD1Db.batch = async (operations: any[]) => {
    const results = [];
    for (const op of operations) {
      if (op.execute) {
        results.push(await op.execute());
      } else if (op.all) {
        results.push(await op.all());
      } else if (op.values) {
        results.push(await op.values());
      } else {
        results.push(await op);
      }
    }
    return results;
  };
});

// Mock @opennextjs/cloudflare to provide test D1 binding
mock.module("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      DB: testD1Db,
      R2_BUCKET: {} as R2Bucket,
      ASSETS: {} as Fetcher,
      VIEWER_KV: {} as KVNamespace,
      AI: {} as Ai,
    },
  }),
}));

// Register happy-dom globals
GlobalRegistrator.register();

// Extend expect with @testing-library/jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  // Close database connections if needed
  if (testD1Db?.close) {
    testD1Db.close();
  }
});
