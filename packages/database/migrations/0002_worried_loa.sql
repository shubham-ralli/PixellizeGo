CREATE TABLE `menus` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(150) NOT NULL,
	`location` varchar(80),
	`items` json NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menus_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `redirects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`from_path` varchar(512) NOT NULL,
	`to_path` varchar(512) NOT NULL,
	`status_code` int NOT NULL DEFAULT 301,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `redirects_id` PRIMARY KEY(`id`),
	CONSTRAINT `redirects_from_unq` UNIQUE(`from_path`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(120) NOT NULL,
	`value` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`name` varchar(150) NOT NULL,
	`version` varchar(40) NOT NULL DEFAULT '1.0.0',
	`description` varchar(255),
	`is_active` boolean NOT NULL DEFAULT false,
	`settings` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `themes_id` PRIMARY KEY(`id`),
	CONSTRAINT `themes_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `menus_location_idx` ON `menus` (`location`);