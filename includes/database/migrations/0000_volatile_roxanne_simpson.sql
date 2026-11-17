CREATE TABLE `comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`parent_id` int,
	`author_name` varchar(120) NOT NULL,
	`author_email` varchar(190) NOT NULL,
	`author_url` varchar(200),
	`content` text NOT NULL,
	`is_staff` boolean NOT NULL DEFAULT false,
	`status` enum('pending','approved','spam','trash') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` int AUTO_INCREMENT NOT NULL,
	`filename` varchar(255) NOT NULL,
	`original_name` varchar(255) NOT NULL,
	`mime_type` varchar(120) NOT NULL,
	`size` int NOT NULL,
	`width` int,
	`height` int,
	`path` varchar(512) NOT NULL,
	`url` varchar(512) NOT NULL,
	`thumbnail_path` varchar(512),
	`thumbnail_url` varchar(512),
	`alt_text` varchar(255),
	`uploaded_by_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `post_meta` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`meta_key` varchar(120) NOT NULL,
	`meta_value` text,
	CONSTRAINT `post_meta_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_meta_post_key_unq` UNIQUE(`post_id`,`meta_key`)
);
--> statement-breakpoint
CREATE TABLE `post_terms` (
	`post_id` int NOT NULL,
	`term_id` int NOT NULL,
	CONSTRAINT `post_terms_post_id_term_id_pk` PRIMARY KEY(`post_id`,`term_id`)
);
--> statement-breakpoint
CREATE TABLE `post_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(60) NOT NULL,
	`label` varchar(120) NOT NULL,
	`label_plural` varchar(120) NOT NULL,
	`route` varchar(120) NOT NULL DEFAULT '',
	`hierarchical` boolean NOT NULL DEFAULT false,
	`has_archive` boolean NOT NULL DEFAULT false,
	`built_in` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `post_types_id` PRIMARY KEY(`id`),
	CONSTRAINT `post_types_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` varchar(60) NOT NULL DEFAULT 'post',
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`excerpt` text,
	`content` mediumtext,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`scheduled_at` datetime,
	`featured_media_id` int,
	`parent_id` int,
	`author_id` int NOT NULL,
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_type_slug_unq` UNIQUE(`type`,`slug`)
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
CREATE TABLE `revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`post_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` mediumtext,
	`kind` enum('manual','autosave') NOT NULL DEFAULT 'manual',
	`author_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(50) NOT NULL,
	`description` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` varchar(120) NOT NULL,
	`value` text,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `taxonomies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(120) NOT NULL,
	`label` varchar(120) NOT NULL,
	`label_plural` varchar(120) NOT NULL,
	`route` varchar(120) NOT NULL,
	`hierarchical` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taxonomies_id` PRIMARY KEY(`id`),
	CONSTRAINT `taxonomies_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `terms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taxonomy_id` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` varchar(255),
	`parent_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `terms_tax_slug_unq` UNIQUE(`taxonomy_id`,`slug`)
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
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`name` varchar(120) NOT NULL,
	`first_name` varchar(120),
	`last_name` varchar(120),
	`bio` text,
	`website` varchar(255),
	`password_hash` varchar(255) NOT NULL,
	`avatar_url` varchar(512),
	`role_id` int NOT NULL,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unq` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `comments` ADD CONSTRAINT `comments_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_uploaded_by_id_users_id_fk` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_meta` ADD CONSTRAINT `post_meta_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_terms` ADD CONSTRAINT `post_terms_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_terms` ADD CONSTRAINT `post_terms_term_id_terms_id_fk` FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_featured_media_id_media_id_fk` FOREIGN KEY (`featured_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `terms` ADD CONSTRAINT `terms_taxonomy_id_taxonomies_id_fk` FOREIGN KEY (`taxonomy_id`) REFERENCES `taxonomies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `comments_post_idx` ON `comments` (`post_id`);--> statement-breakpoint
CREATE INDEX `comments_status_idx` ON `comments` (`status`);--> statement-breakpoint
CREATE INDEX `media_created_idx` ON `media` (`created_at`);--> statement-breakpoint
CREATE INDEX `menus_location_idx` ON `menus` (`location`);--> statement-breakpoint
CREATE INDEX `post_terms_term_idx` ON `post_terms` (`term_id`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_published_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `posts_deleted_idx` ON `posts` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `revisions_post_idx` ON `revisions` (`post_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `terms_tax_idx` ON `terms` (`taxonomy_id`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role_id`);