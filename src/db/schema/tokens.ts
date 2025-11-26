import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Tokens table - stores token metadata from CoinGecko
 * Requirement 4, 8, 9
 */
export const tokens = sqliteTable(
  "tokens",
  {
    id: text("id").primaryKey().notNull(), // CoinGecko token ID (e.g., "bitcoin")
    symbol: text("symbol").notNull(), // Token symbol (e.g., "BTC")
    name: text("name").notNull(), // Token name (e.g., "Bitcoin")
    coingeckoId: text("coingecko_id").notNull(), // CoinGecko ID (same as id, for explicit reference)
    logoUrl: text("logo_url"), // Token logo image URL
    shortContext: text("short_context"), // 2-4 sentence English description of the token's purpose, narrative, and key characteristics (50-500 characters)
    categories: text("categories").notNull(), // JSON array string (e.g., '["l1", "store-of-value"]')
    createdAt: integer("created_at").notNull(), // Unix epoch seconds
    updatedAt: integer("updated_at").notNull(), // Unix epoch seconds
  },
  table => [index("idx_tokens_symbol").on(table.symbol), index("idx_tokens_coingecko_id").on(table.coingeckoId)],
);

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
