CREATE TABLE `dealers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_key` text NOT NULL,
	`normalized_name` text NOT NULL,
	`normalized_phone` text,
	`rank` integer NOT NULL,
	`name` text NOT NULL,
	`legal_name` text,
	`city` text DEFAULT 'Шымкент' NOT NULL,
	`address` text,
	`phone` text,
	`additional_phones` text,
	`whatsapp` text,
	`whatsapp_normalized` text,
	`email` text,
	`website` text,
	`social` text,
	`priority` text NOT NULL,
	`status` text DEFAULT 'candidate' NOT NULL,
	`note` text,
	`source` text,
	`source_url` text,
	`source_checked_at` text,
	`source_imported_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dealers_external_key_unique` ON `dealers` (`external_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `dealers_normalized_name_unique` ON `dealers` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `dealers_normalized_phone_idx` ON `dealers` (`normalized_phone`);--> statement-breakpoint
CREATE INDEX `dealers_priority_idx` ON `dealers` (`priority`);--> statement-breakpoint
CREATE INDEX `dealers_status_idx` ON `dealers` (`status`);