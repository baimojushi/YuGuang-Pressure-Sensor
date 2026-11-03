CREATE TABLE `households` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`device_key_hash` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `households_device_key_hash_unique` ON `households` (`device_key_hash`);