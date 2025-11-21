import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Token Contexts table - stores AI-generated token context (shortContext, category, tags)
 * Used by token-context-service to cache Tavily + Workers AI results
 * Requirement: dynamic-prompt spec
 */
export const tokenContexts = sqliteTable(
  "token_contexts",
  {
    tokenId: text("token_id").primaryKey().notNull(), // CoinGecko token ID (e.g., "bitcoin")
    symbol: text("symbol").notNull(), // Token symbol (e.g., "BTC")
    displayName: text("display_name").notNull(), // Token display name (e.g., "Bitcoin")
    chain: text("chain").notNull(), // Chain ID (e.g., "solana", "ethereum")
    category: text("category"), // Single word category (e.g., "meme", "defi")
    tags: text("tags"), // JSON array string (e.g., '["meme", "viral"]')
    shortContext: text("short_context").notNull(), // 2-4 sentence English description (200-400 chars)
    updatedAt: integer("updated_at").notNull(), // Unix epoch seconds
  },
  table => [index("idx_token_contexts_symbol_chain").on(table.symbol, table.chain)],
);

export type TokenContextRow = typeof tokenContexts.$inferSelect;
export type NewTokenContextRow = typeof tokenContexts.$inferInsert;
