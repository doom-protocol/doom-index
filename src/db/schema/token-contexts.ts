import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Token contexts table - Cache for token short contexts and metadata
 * Stores token-specific narrative context generated from Tavily + Workers AI
 */
export const tokenContexts = sqliteTable(
  "token_contexts",
  {
    tokenId: text("token_id").primaryKey().notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    chainId: text("chain_id").notNull(),
    contractAddress: text("contract_address"),
    category: text("category"),
    tags: text("tags"), // JSON string array: ["tag1", "tag2"]
    shortContext: text("short_context").notNull(),
    createdAt: integer("created_at").notNull(), // Unix epoch seconds
    updatedAt: integer("updated_at").notNull(), // Unix epoch seconds
  },
  table => [index("idx_token_contexts_symbol_chain").on(table.symbol, table.chainId)],
);

/**
 * Type definitions (using Drizzle's type inference)
 */
export type TokenContextRow = typeof tokenContexts.$inferSelect;
export type NewTokenContextRow = typeof tokenContexts.$inferInsert;
