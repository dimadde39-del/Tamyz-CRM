ALTER TABLE `dealers` ADD `regions` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `categories` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `brands` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `channels` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `confidence` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `score` integer;--> statement-breakpoint
ALTER TABLE `dealers` ADD `whatsapp_confirmed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `dealers` ADD `distribution_evidence` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `shymkent_evidence` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `warehouse_evidence` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `logistics_evidence` text;--> statement-breakpoint
ALTER TABLE `dealers` ADD `sales_team_evidence` text;