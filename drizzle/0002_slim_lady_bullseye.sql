CREATE TABLE `client_registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`client_id` integer NOT NULL,
	`supplier_id` integer NOT NULL,
	`status` text DEFAULT 'черновик' NOT NULL,
	`response_type` text,
	`requested_commission_percent` real NOT NULL,
	`confirmed_commission_percent` real,
	`requested_repeat_commission_months` integer NOT NULL,
	`confirmed_repeat_commission_months` integer,
	`commission_payment_business_days` integer NOT NULL,
	`supplier_response_text` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`request_sent_at` integer,
	`confirmed_at` integer,
	`introduced_at` integer,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `client_registrations_client_supplier_unique` ON `client_registrations` (`client_id`,`supplier_id`);--> statement-breakpoint
CREATE INDEX `client_registrations_status_idx` ON `client_registrations` (`status`);--> statement-breakpoint
CREATE INDEX `client_registrations_supplier_idx` ON `client_registrations` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `client_registrations_request_sent_idx` ON `client_registrations` (`request_sent_at`);--> statement-breakpoint
ALTER TABLE `clients` ADD `bin` text;