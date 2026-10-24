CREATE TABLE `consents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`purpose` text NOT NULL,
	`granted` integer NOT NULL,
	`version` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `consents_owner` ON `consents` (`owner_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`properties` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_name_date` ON `events` (`name`,`created_at`);--> statement-breakpoint
CREATE INDEX `events_owner` ON `events` (`owner_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`age_confirmed` integer DEFAULT false NOT NULL,
	`quiz_json` text
);
--> statement-breakpoint
CREATE TABLE `progress_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`object_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `photos_owner` ON `progress_photos` (`owner_id`);--> statement-breakpoint
CREATE TABLE `routine_ticks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`date` text NOT NULL,
	`slot` text NOT NULL,
	`step` text NOT NULL,
	`done` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tick_unique` ON `routine_ticks` (`owner_id`,`date`,`slot`,`step`);--> statement-breakpoint
CREATE TABLE `rules` (
	`concern` text PRIMARY KEY NOT NULL,
	`data_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scan_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reservations_day` ON `scan_reservations` (`day`);--> statement-breakpoint
CREATE INDEX `reservations_owner_day` ON `scan_reservations` (`owner_id`,`day`);--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`quiz_json` text NOT NULL,
	`result_json` text,
	`source` text NOT NULL,
	`model` text,
	`message` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `scans_owner_date` ON `scans` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shelf_items` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`step` text NOT NULL,
	`product_id` text,
	`has_active` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shelf_owner` ON `shelf_items` (`owner_id`);--> statement-breakpoint
CREATE TABLE `user_roles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `waitlist` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`price` text,
	`referral` text,
	`created_at` text NOT NULL
);
