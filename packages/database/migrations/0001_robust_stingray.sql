CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`description` varchar(255),
	`parent_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unq` UNIQUE(`slug`)
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
	`alt_text` varchar(255),
	`uploaded_by_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_categories` (
	`post_id` int NOT NULL,
	`category_id` int NOT NULL,
	CONSTRAINT `post_categories_post_id_category_id_pk` PRIMARY KEY(`post_id`,`category_id`)
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
CREATE TABLE `post_tags` (
	`post_id` int NOT NULL,
	`tag_id` int NOT NULL,
	CONSTRAINT `post_tags_post_id_tag_id_pk` PRIMARY KEY(`post_id`,`tag_id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('post','page') NOT NULL DEFAULT 'post',
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`excerpt` text,
	`content` mediumtext,
	`status` enum('draft','published','scheduled') NOT NULL DEFAULT 'draft',
	`published_at` datetime,
	`scheduled_at` datetime,
	`featured_media_id` int,
	`author_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `posts_id` PRIMARY KEY(`id`),
	CONSTRAINT `posts_type_slug_unq` UNIQUE(`type`,`slug`)
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
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(120) NOT NULL,
	`slug` varchar(140) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unq` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `media` ADD CONSTRAINT `media_uploaded_by_id_users_id_fk` FOREIGN KEY (`uploaded_by_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_categories` ADD CONSTRAINT `post_categories_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_categories` ADD CONSTRAINT `post_categories_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_meta` ADD CONSTRAINT `post_meta_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `post_tags` ADD CONSTRAINT `post_tags_tag_id_tags_id_fk` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_featured_media_id_media_id_fk` FOREIGN KEY (`featured_media_id`) REFERENCES `media`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `posts` ADD CONSTRAINT `posts_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_post_id_posts_id_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisions` ADD CONSTRAINT `revisions_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `media_created_idx` ON `media` (`created_at`);--> statement-breakpoint
CREATE INDEX `posts_status_idx` ON `posts` (`status`);--> statement-breakpoint
CREATE INDEX `posts_author_idx` ON `posts` (`author_id`);--> statement-breakpoint
CREATE INDEX `posts_published_idx` ON `posts` (`published_at`);--> statement-breakpoint
CREATE INDEX `revisions_post_idx` ON `revisions` (`post_id`);