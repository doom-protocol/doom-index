import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Market Snapshots table - stores global market data snapshots
 * Requirement 3, 8, 9, 10
 */
export const marketSnapshots = sqliteTable(
  "market_snapshots",
  {
    hourBucket: text("hour_bucket").primaryKey().notNull(), // Interval bucket based on GENERATION_INTERVAL_MS (e.g., "2025-11-21T15:00" for 10min intervals)
    totalMarketCapUsd: real("total_market_cap_usd").notNull(), // Global market cap (USD)
    totalVolumeUsd: real("total_volume_usd").notNull(), // Global volume (USD)
    marketCapChangePercentage24hUsd: real("market_cap_change_percentage_24h_usd").notNull(), // Global market cap 24h change (%)
    btcDominance: real("btc_dominance").notNull(), // BTC dominance (%)
    ethDominance: real("eth_dominance").notNull(), // ETH dominance (%)
    activeCryptocurrencies: integer("active_cryptocurrencies").notNull(), // Active cryptocurrencies count
    markets: integer("markets").notNull(), // Markets count
    fearGreedIndex: integer("fear_greed_index"), // Fear & Greed Index (0-100, nullable)
    updatedAt: integer("updated_at").notNull(), // CoinGecko data updated_at (Unix epoch seconds)
    createdAt: integer("created_at").notNull(), // Record created_at (Unix epoch seconds)
  },
  table => [index("idx_market_snapshots_created_at").on(table.createdAt)],
);

export type MarketSnapshot = typeof marketSnapshots.$inferSelect;
export type NewMarketSnapshot = typeof marketSnapshots.$inferInsert;
