ALTER TABLE `posts` ADD `deleted_at` datetime;--> statement-breakpoint
CREATE INDEX `posts_deleted_idx` ON `posts` (`deleted_at`);