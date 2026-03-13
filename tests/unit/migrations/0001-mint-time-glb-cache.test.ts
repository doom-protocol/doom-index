import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function runStatements(sqlite: Database, statements: string[]): void {
  for (const statement of statements) {
    sqlite.run(statement);
  }
}

function loadMigrationStatements(fileName: string): string[] {
  const migrationSql = readFileSync(join(process.cwd(), "migrations", fileName), "utf8");

  return migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

describe("migrations/0001_mint_time_glb_cache.sql", () => {
  it("upgrades the historical r2_key schema without requiring image_tx_id columns", () => {
    const sqlite = new Database(":memory:");

    runStatements(sqlite, [
      `CREATE TABLE paintings (
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
      )`,
      "CREATE INDEX idx_paintings_ts_id ON paintings(ts, id)",
      "CREATE INDEX idx_paintings_ts ON paintings(ts)",
      "CREATE INDEX idx_paintings_params_hash ON paintings(params_hash)",
      "CREATE INDEX idx_paintings_seed ON paintings(seed)",
      "CREATE UNIQUE INDEX idx_paintings_r2_key ON paintings(r2_key)",
      `INSERT INTO paintings (
        id, ts, timestamp, minute_bucket, params_hash, seed, r2_key, image_url, file_size, visual_params_json, prompt, negative
      ) VALUES (
        'painting-1',
        1741852800,
        '2025-03-13T00:00:00.000Z',
        '2025/03/13/00/00',
        'hash',
        'seed',
        'images/2025/03/13/painting-1.webp',
        'https://example.test/painting-1.webp',
        12345,
        '{}',
        'prompt',
        'negative'
      )`,
    ]);

    runStatements(sqlite, loadMigrationStatements("0001_mint_time_glb_cache.sql"));

    const migratedRow = sqlite
      .query("SELECT image_tx_id, glb_tx_id, image_url, glb_url FROM paintings WHERE id = 'painting-1'")
      .get() as
      | {
          glb_tx_id: string | null;
          glb_url: string | null;
          image_tx_id: string;
          image_url: string;
        }
      | undefined;

    expect(migratedRow).toEqual({
      glb_tx_id: null,
      glb_url: null,
      image_tx_id: "images/2025/03/13/painting-1.webp",
      image_url: "https://example.test/painting-1.webp",
    });
  });
});
