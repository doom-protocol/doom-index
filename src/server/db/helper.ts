import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as schema from "./schema";

export const DEFAULT_LOCAL_D1_STATE_DIR = ".wrangler/state/v3/d1/miniflare-D1DatabaseObject";

/**
 * Resolve the Wrangler-managed local D1 SQLite file.
 */
export function resolveLocalD1SqlitePath(explicitPath?: string, stateDir: string = DEFAULT_LOCAL_D1_STATE_DIR): string {
  if (explicitPath) {
    return explicitPath;
  }

  if (!existsSync(stateDir)) {
    throw new Error(
      `Wrangler local D1 database not found. Expected local state directory at ${stateDir}. Run Wrangler local dev/migrations first or pass --db.`,
    );
  }

  const candidatePaths = readdirSync(stateDir)
    .filter((entry) => entry.endsWith(".sqlite") || entry.endsWith(".db"))
    .map((entry) => join(stateDir, entry))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

  const databasePath = candidatePaths[0];
  if (!databasePath) {
    throw new Error(
      `Wrangler local D1 database not found. No .sqlite files were present in ${stateDir}. Run Wrangler local dev/migrations first or pass --db.`,
    );
  }

  return databasePath;
}

/**
 * Open the local Wrangler D1 SQLite state through Drizzle.
 */
export const setupLocalDb = (dbPath?: string): BunSQLiteDatabase<typeof schema> => {
  const resolvedDbPath = resolveLocalD1SqlitePath(dbPath);
  const sqlite = new Database(resolvedDbPath, {
    create: false,
    readwrite: true,
  });

  return drizzle(sqlite, { schema });
};
