CREATE TABLE `invites` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`referred_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_unique` ON `invites` (`code`);--> statement-breakpoint
CREATE TABLE `referral_signups` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`created_at` text NOT NULL
);
