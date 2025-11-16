CREATE TABLE `archive_items` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`timestamp` text NOT NULL,
	`minute_bucket` text NOT NULL,
	`params_hash` text NOT NULL,
	`seed` text NOT NULL,
	`r2_key` text NOT NULL,
	`image_url` text NOT NULL,
	`file_size` integer NOT NULL,
	`mc_rounded_json` text NOT NULL,
	`visual_params_json` text NOT NULL,
	`prompt` text NOT NULL,
	`negative` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_archive_ts_id` ON `archive_items` (`ts`,`id`);--> statement-breakpoint
CREATE INDEX `idx_archive_ts` ON `archive_items` (`ts`);--> statement-breakpoint
CREATE INDEX `idx_archive_params_hash` ON `archive_items` (`params_hash`);--> statement-breakpoint
CREATE INDEX `idx_archive_seed` ON `archive_items` (`seed`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_archive_r2_key` ON `archive_items` (`r2_key`);