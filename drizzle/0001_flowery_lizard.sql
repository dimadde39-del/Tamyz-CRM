CREATE TABLE `test_basket_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`test_basket_id` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`product` text NOT NULL,
	`sku` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`test_basket_id`) REFERENCES `test_baskets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `test_basket_items_basket_idx` ON `test_basket_items` (`test_basket_id`);--> statement-breakpoint
CREATE TABLE `test_baskets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`external_key` text NOT NULL,
	`supplier_id` integer NOT NULL,
	`owner` text DEFAULT 'Димаш' NOT NULL,
	`name` text NOT NULL,
	`dealer_amount` integer NOT NULL,
	`rrp_amount` integer NOT NULL,
	`price_difference` integer NOT NULL,
	`currency` text DEFAULT 'KZT' NOT NULL,
	`commission_status` text DEFAULT 'unknown' NOT NULL,
	`difference_is_profit` integer DEFAULT false NOT NULL,
	`next_action` text,
	`next_action_at` integer,
	`internal_note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `test_baskets_external_key_unique` ON `test_baskets` (`external_key`);--> statement-breakpoint
CREATE INDEX `test_baskets_supplier_idx` ON `test_baskets` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `test_baskets_next_action_idx` ON `test_baskets` (`next_action_at`);