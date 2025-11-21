import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * Paintings table - Generated artworks with metadata
 * Enables efficient DESC sorting and pagination for archive page
 */
export const paintings = sqliteTable(
  "paintings",
  {
    id: text("id").primaryKey().notNull(),

    ts: integer("ts").notNull(), // Unix epoch seconds (minute-level precision)
    timestamp: text("timestamp").notNull(), // ISO 8601 format: "YYYY-MM-DDTHH:MM:SSZ"
    minuteBucket: text("minute_bucket").notNull(), // Same as timestamp (kept for PaintingMetadata compatibility)

    paramsHash: text("params_hash").notNull(), // 8-character hex hash of visual parameters
    seed: text("seed").notNull(), // 12-character hex seed for reproducibility

    r2Key: text("r2_key").notNull(), // Full R2 object key: images/YYYY/MM/DD/DOOM_...
    imageUrl: text("image_url").notNull(), // Public CDN URL for the image
    fileSize: integer("file_size").notNull(), // Image file size in bytes

    mcRoundedJson: text("mc_rounded_json").notNull(), // JSON: { CO2: number, ICE: number, ... }
    visualParamsJson: text("visual_params_json").notNull(), // JSON: { fogDensity: number, skyTint: number, ... }

    prompt: text("prompt").notNull(), // Positive prompt text
    negative: text("negative").notNull(), // Negative prompt text
  },
  table => [
    index("idx_paintings_ts_id").on(table.ts, table.id),
    index("idx_paintings_ts").on(table.ts),
    index("idx_paintings_params_hash").on(table.paramsHash),
    index("idx_paintings_seed").on(table.seed),
    uniqueIndex("idx_paintings_r2_key").on(table.r2Key),
  ],
);

/**
 * Type definitions (using Drizzle's type inference)
 */
export type Painting = typeof paintings.$inferSelect;
export type NewPainting = typeof paintings.$inferInsert;
