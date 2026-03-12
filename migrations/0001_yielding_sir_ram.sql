DROP INDEX `idx_paintings_r2_key`;--> statement-breakpoint
ALTER TABLE `paintings` ADD `image_tx_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `paintings` ADD `glb_tx_id` text NOT NULL;--> statement-breakpoint
ALTER TABLE `paintings` ADD `glb_url` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paintings_image_tx_id` ON `paintings` (`image_tx_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_paintings_glb_tx_id` ON `paintings` (`glb_tx_id`);--> statement-breakpoint
ALTER TABLE `paintings` DROP COLUMN `r2_key`;