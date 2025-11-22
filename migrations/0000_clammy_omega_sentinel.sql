CREATE TABLE `paintings` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`timestamp` text NOT NULL,
	`minute_bucket` text NOT NULL,
	`params_hash` text NOT NULL,
	`seed` text NOT NULL,
	`r2_key` text NOT NULL,
	`image_url` text NOT NULL,
	`file_size` integer NOT NULL,
	`visual_params_json` text NOT NULL,
	`prompt` text NOT NULL,
	`negative` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_paintings_ts_id` ON `paintings` (`ts`,`id`);--> statement-breakpoint
CREATE INDEX `idx_paintings_ts` ON `paintings` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_paintings_params_hash` ON `paintings` (`params_hash`);--> statement-breakpoint
CREATE INDEX `idx_paintings_seed` ON `paintings` (`seed`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paintings_r2_key` ON `paintings` (`r2_key`);--> statement-breakpoint
CREATE TABLE `tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`name` text NOT NULL,
	`coingecko_id` text NOT NULL,
	`logo_url` text,
	`short_context` text,
	`categories` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tokens_symbol` ON `tokens` (`symbol`);--> statement-breakpoint
CREATE INDEX `idx_tokens_coingecko_id` ON `tokens` (`coingecko_id`);--> statement-breakpoint
CREATE TABLE `market_snapshots` (
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
CREATE INDEX `idx_market_snapshots_created_at` ON `market_snapshots` (`created_at`);