-- Migration: Add tokens and market_snapshots tables for dynamic-draw feature

-- Create tokens table
CREATE TABLE IF NOT EXISTS `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`coingecko_id` text NOT NULL,
	`logo_url` text,
	`categories` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tokens_symbol` ON `tokens` (`symbol`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_tokens_coingecko_id` ON `tokens` (`coingecko_id`);

-- Create market_snapshots table
CREATE TABLE IF NOT EXISTS `market_snapshots` (
	`hour_bucket` text PRIMARY KEY NOT NULL,
	`total_market_cap_usd` real NOT NULL,
	`total_volume_usd` real NOT NULL,
	`market_cap_change_percentage_24h_usd` real NOT NULL,
	`btc_dominance` real NOT NULL,
	`eth_dominance` real NOT NULL,
	`active_cryptocurrencies` integer NOT NULL,
	`markets` integer NOT NULL,
	`fear_greed_index` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_market_snapshots_created_at` ON `market_snapshots` (`created_at`);
