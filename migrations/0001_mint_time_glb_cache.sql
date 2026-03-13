PRAGMA foreign_keys=OFF;
--> statement-breakpoint
ALTER TABLE `paintings` RENAME TO `__old_paintings`;
--> statement-breakpoint
CREATE TABLE `paintings` (
	`id` text PRIMARY KEY NOT NULL,
	`ts` integer NOT NULL,
	`timestamp` text NOT NULL,
	`minute_bucket` text NOT NULL,
	`params_hash` text NOT NULL,
	`seed` text NOT NULL,
	`image_tx_id` text NOT NULL,
	`glb_tx_id` text,
	`image_url` text NOT NULL,
	`glb_url` text,
	`file_size` integer NOT NULL,
	`visual_params_json` text NOT NULL,
	`prompt` text NOT NULL,
	`negative` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `paintings` (
	`id`,
	`ts`,
	`timestamp`,
	`minute_bucket`,
	`params_hash`,
	`seed`,
	`image_tx_id`,
	`glb_tx_id`,
	`image_url`,
	`glb_url`,
	`file_size`,
	`visual_params_json`,
	`prompt`,
	`negative`
)
SELECT
	`id`,
	`ts`,
	`timestamp`,
	`minute_bucket`,
	`params_hash`,
	`seed`,
	`r2_key`,
	NULL,
	`image_url`,
	NULL,
	`file_size`,
	`visual_params_json`,
	`prompt`,
	`negative`
FROM `__old_paintings`;
--> statement-breakpoint
DROP TABLE `__old_paintings`;
--> statement-breakpoint
CREATE INDEX `idx_paintings_ts_id` ON `paintings` (`ts`,`id`);
--> statement-breakpoint
CREATE INDEX `idx_paintings_ts` ON `paintings` (`ts`);
--> statement-breakpoint
CREATE INDEX `idx_paintings_params_hash` ON `paintings` (`params_hash`);
--> statement-breakpoint
CREATE INDEX `idx_paintings_seed` ON `paintings` (`seed`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paintings_image_tx_id` ON `paintings` (`image_tx_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paintings_glb_tx_id` ON `paintings` (`glb_tx_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
