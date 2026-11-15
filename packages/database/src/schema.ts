import { relations } from "drizzle-orm";
import {
  boolean,
  datetime,
  index,
  int,
  json,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * Phase 1 schema: roles, users, sessions.
 * Content tables (posts, pages, media, ...) are added in Phase 2.
 */

export const roles = mysqlTable(
  "roles",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 50 }).notNull(),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("roles_name_unq").on(t.name)],
);

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    avatarUrl: varchar("avatar_url", { length: 512 }),
    roleId: int("role_id")
      .notNull()
      .references(() => roles.id),
    status: mysqlEnum("status", ["active", "disabled"]).default("active").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [uniqueIndex("users_email_unq").on(t.email), index("users_role_idx").on(t.roleId)],
);

export const sessions = mysqlTable(
  "sessions",
  {
    // sha256 hex of the raw session token held in the cookie
    id: varchar("id", { length: 64 }).primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const usersRelations = relations(users, ({ one, many }) => ({
  role: one(roles, { fields: [users.roleId], references: [roles.id] }),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type RoleRow = typeof roles.$inferSelect;

/* ------------------------------------------------------------------ */
/* Phase 2: content                                                    */
/* ------------------------------------------------------------------ */

export const media = mysqlTable(
  "media",
  {
    id: int("id").autoincrement().primaryKey(),
    filename: varchar("filename", { length: 255 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 120 }).notNull(),
    size: int("size").notNull(),
    width: int("width"),
    height: int("height"),
    path: varchar("path", { length: 512 }).notNull(),
    url: varchar("url", { length: 512 }).notNull(),
    altText: varchar("alt_text", { length: 255 }),
    uploadedById: int("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("media_created_idx").on(t.createdAt)],
);

export const posts = mysqlTable(
  "posts",
  {
    id: int("id").autoincrement().primaryKey(),
    type: mysqlEnum("type", ["post", "page"]).default("post").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    excerpt: text("excerpt"),
    content: mediumtext("content"),
    status: mysqlEnum("status", ["draft", "published", "scheduled"]).default("draft").notNull(),
    publishedAt: datetime("published_at"),
    scheduledAt: datetime("scheduled_at"),
    featuredMediaId: int("featured_media_id").references(() => media.id, { onDelete: "set null" }),
    authorId: int("author_id")
      .notNull()
      .references(() => users.id),
    deletedAt: datetime("deleted_at"), // soft delete (trash); null = active
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    uniqueIndex("posts_type_slug_unq").on(t.type, t.slug),
    index("posts_status_idx").on(t.status),
    index("posts_author_idx").on(t.authorId),
    index("posts_published_idx").on(t.publishedAt),
    index("posts_deleted_idx").on(t.deletedAt),
  ],
);

// Flexible key/value metadata (SEO, Open Graph, canonical, future custom fields).
export const postMeta = mysqlTable(
  "post_meta",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    metaKey: varchar("meta_key", { length: 120 }).notNull(),
    metaValue: text("meta_value"),
  },
  (t) => [uniqueIndex("post_meta_post_key_unq").on(t.postId, t.metaKey)],
);

export const revisions = mysqlTable(
  "revisions",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    content: mediumtext("content"),
    kind: mysqlEnum("kind", ["manual", "autosave"]).default("manual").notNull(),
    authorId: int("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("revisions_post_idx").on(t.postId)],
);

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: varchar("description", { length: 255 }),
    parentId: int("parent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("categories_slug_unq").on(t.slug)],
);

export const tags = mysqlTable(
  "tags",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("tags_slug_unq").on(t.slug)],
);

export const postCategories = mysqlTable(
  "post_categories",
  {
    postId: int("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    categoryId: int("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.categoryId] })],
);

export const postTags = mysqlTable(
  "post_tags",
  {
    postId: int("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.tagId] })],
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  featuredMedia: one(media, { fields: [posts.featuredMediaId], references: [media.id] }),
  meta: many(postMeta),
  revisions: many(revisions),
  postCategories: many(postCategories),
  postTags: many(postTags),
}));

export const postMetaRelations = relations(postMeta, ({ one }) => ({
  post: one(posts, { fields: [postMeta.postId], references: [posts.id] }),
}));

export const postCategoriesRelations = relations(postCategories, ({ one }) => ({
  post: one(posts, { fields: [postCategories.postId], references: [posts.id] }),
  category: one(categories, { fields: [postCategories.categoryId], references: [categories.id] }),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, { fields: [postTags.postId], references: [posts.id] }),
  tag: one(tags, { fields: [postTags.tagId], references: [tags.id] }),
}));

export type MediaRow = typeof media.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;
export type PostMetaRow = typeof postMeta.$inferSelect;
export type RevisionRow = typeof revisions.$inferSelect;
export type CategoryRow = typeof categories.$inferSelect;
export type TagRow = typeof tags.$inferSelect;

/* ------------------------------------------------------------------ */
/* Phase 3: website engine (themes, menus, settings, redirects)        */
/* ------------------------------------------------------------------ */

export const themes = mysqlTable(
  "themes",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    version: varchar("version", { length: 40 }).default("1.0.0").notNull(),
    description: varchar("description", { length: 255 }),
    isActive: boolean("is_active").default(false).notNull(),
    settings: json("settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("themes_slug_unq").on(t.slug)],
);

export interface MenuItem {
  label: string;
  url: string;
  children?: MenuItem[];
}

export const menus = mysqlTable(
  "menus",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 150 }).notNull(),
    location: varchar("location", { length: 80 }), // e.g. "primary", "footer"
    items: json("items").$type<MenuItem[]>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [index("menus_location_idx").on(t.location)],
);

// Key/value site settings (site title, tagline, SEO defaults, etc.)
export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 120 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const redirects = mysqlTable(
  "redirects",
  {
    id: int("id").autoincrement().primaryKey(),
    fromPath: varchar("from_path", { length: 512 }).notNull(),
    toPath: varchar("to_path", { length: 512 }).notNull(),
    statusCode: int("status_code").default(301).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("redirects_from_unq").on(t.fromPath)],
);

export type ThemeRow = typeof themes.$inferSelect;
export type MenuRow = typeof menus.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type RedirectRow = typeof redirects.$inferSelect;
