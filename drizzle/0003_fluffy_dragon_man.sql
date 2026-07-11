CREATE TABLE `economics_scenarios` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`supplier_id` integer NOT NULL,
	`registration_id` integer,
	`test_basket_id` integer,
	`copied_from_scenario_id` integer,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`terms_status` text NOT NULL,
	`earning_mode` text NOT NULL,
	`calculation_version` integer DEFAULT 1 NOT NULL,
	`snapshot_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`registration_id`) REFERENCES `client_registrations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`test_basket_id`) REFERENCES `test_baskets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `economics_scenarios_client_idx` ON `economics_scenarios` (`client_id`);--> statement-breakpoint
CREATE INDEX `economics_scenarios_supplier_idx` ON `economics_scenarios` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `economics_scenarios_updated_idx` ON `economics_scenarios` (`updated_at`);