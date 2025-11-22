import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

/**
 * Create a local SQLite database instance using Bun's native SQLite driver
 * Used for local testing and scripts without D1
 */
export const createLocalDb = (dbPath: string = "local-test.db") => {
  const sqlite = new Database(dbPath);
  return drizzle(sqlite, { schema });
};

/**
 * Setup local database with schema tables
 * Creates tables if they don't exist
 */
export const setupLocalDb = async (dbPath: string = "local-test.db") => {
  const sqlite = new Database(dbPath);
  const db = drizzle(sqlite, { schema });

  // Create tokens table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS tokens (
      id TEXT PRIMARY KEY NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      coingecko_id TEXT NOT NULL,
      logo_url TEXT,
      short_context TEXT,
      categories TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  // Create market_snapshots table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS market_snapshots (
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
  `);

  // Create paintings table (matching src/db/schema/paintings.ts)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS paintings (
      id TEXT PRIMARY KEY NOT NULL,
      ts INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      minute_bucket TEXT NOT NULL,
      params_hash TEXT NOT NULL,
      seed TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      image_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      visual_params_json TEXT NOT NULL,
      prompt TEXT NOT NULL,
      negative TEXT NOT NULL
    );
  `);

  return db;
};
