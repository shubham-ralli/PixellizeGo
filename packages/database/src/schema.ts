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
    name: varchar("name", { length: 120 }).notNull(), // display / show name
    firstName: varchar("first_name", { length: 120 }),
    lastName: varchar("last_name", { length: 120 }),
    bio: text("bio"),
    website: varchar("website", { length: 255 }),
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
    thumbnailPath: varchar("thumbnail_path", { length: 512 }),
    thumbnailUrl: varchar("thumbnail_url", { length: 512 }),
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
    type: varchar("type", { length: 60 }).default("post").notNull(), // post_types.slug
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    excerpt: text("excerpt"),
    content: mediumtext("content"),
    status: mysqlEnum("status", ["draft", "published", "scheduled"]).default("draft").notNull(),
    publishedAt: datetime("published_at"),
    scheduledAt: datetime("scheduled_at"),
    featuredMediaId: int("featured_media_id").references(() => media.id, { onDelete: "set null" }),
    parentId: int("parent_id"), // hierarchical pages: another post of the same type
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

// Generic post-type registry: "post", "page", or any custom post type.
// posts.type references post_types.slug. Add a new content type by inserting a
// row here (or via the admin Post Types screen) — no schema change needed.
export const postTypes = mysqlTable(
  "post_types",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 60 }).notNull(), // e.g. "post", "page", "product"
    label: varchar("label", { length: 120 }).notNull(), // singular, e.g. "Post"
    labelPlural: varchar("label_plural", { length: 120 }).notNull(), // "Posts"
    route: varchar("route", { length: 120 }).notNull().default(""), // public URL prefix; "" = top-level (pages)
    hierarchical: boolean("hierarchical").default(false).notNull(), // supports parent/child (like pages)
    hasArchive: boolean("has_archive").default(false).notNull(),
    builtIn: boolean("built_in").default(false).notNull(), // post/page — not user-deletable
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("post_types_slug_unq").on(t.slug)],
);

// Generic taxonomy system: a taxonomy ("category", "tag", or any future one)
// groups terms; posts link to terms via post_terms. Add a new taxonomy by
// inserting a row here — no schema change needed.
export const taxonomies = mysqlTable(
  "taxonomies",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(), // e.g. "category", "tag", "topic"
    label: varchar("label", { length: 120 }).notNull(), // singular, e.g. "Category"
    labelPlural: varchar("label_plural", { length: 120 }).notNull(), // "Categories"
    route: varchar("route", { length: 120 }).notNull(), // public URL prefix, e.g. "category"
    hierarchical: boolean("hierarchical").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("taxonomies_slug_unq").on(t.slug)],
);

export const terms = mysqlTable(
  "terms",
  {
    id: int("id").autoincrement().primaryKey(),
    taxonomyId: int("taxonomy_id")
      .notNull()
      .references(() => taxonomies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: varchar("description", { length: 255 }),
    parentId: int("parent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("terms_tax_slug_unq").on(t.taxonomyId, t.slug), index("terms_tax_idx").on(t.taxonomyId)],
);

export const postTerms = mysqlTable(
  "post_terms",
  {
    postId: int("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    termId: int("term_id")
      .notNull()
      .references(() => terms.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.termId] }), index("post_terms_term_idx").on(t.termId)],
);

// Visitor comments on posts. New comments start as "pending" and only
// "approved" ones render publicly.
export const comments = mysqlTable(
  "comments",
  {
    id: int("id").autoincrement().primaryKey(),
    postId: int("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: int("parent_id"), // threaded replies (e.g. an admin replying to a comment)
    authorName: varchar("author_name", { length: 120 }).notNull(),
    authorEmail: varchar("author_email", { length: 190 }).notNull(),
    authorUrl: varchar("author_url", { length: 200 }),
    content: text("content").notNull(),
    isStaff: boolean("is_staff").default(false).notNull(), // reply posted by a logged-in admin
    status: mysqlEnum("status", ["pending", "approved", "spam", "trash"]).default("pending").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("comments_post_idx").on(t.postId), index("comments_status_idx").on(t.status)],
);

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  featuredMedia: one(media, { fields: [posts.featuredMediaId], references: [media.id] }),
  meta: many(postMeta),
  revisions: many(revisions),
  postTerms: many(postTerms),
  comments: many(comments),
}));

export const postMetaRelations = relations(postMeta, ({ one }) => ({
  post: one(posts, { fields: [postMeta.postId], references: [posts.id] }),
}));

export const termsRelations = relations(terms, ({ one, many }) => ({
  taxonomy: one(taxonomies, { fields: [terms.taxonomyId], references: [taxonomies.id] }),
  postTerms: many(postTerms),
}));

export const postTermsRelations = relations(postTerms, ({ one }) => ({
  post: one(posts, { fields: [postTerms.postId], references: [posts.id] }),
  term: one(terms, { fields: [postTerms.termId], references: [terms.id] }),
}));

export type MediaRow = typeof media.$inferSelect;
export type PostRow = typeof posts.$inferSelect;
export type NewPostRow = typeof posts.$inferInsert;
export type PostMetaRow = typeof postMeta.$inferSelect;
export type RevisionRow = typeof revisions.$inferSelect;
export type PostTypeRow = typeof postTypes.$inferSelect;
export type CommentRow = typeof comments.$inferSelect;
export type TaxonomyRow = typeof taxonomies.$inferSelect;
export type TermRow = typeof terms.$inferSelect;

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

// Installed plugins. Unlike themes, several can be active at once.
export const plugins = mysqlTable(
  "plugins",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 150 }).notNull(),
    version: varchar("version", { length: 40 }).default("1.0.0").notNull(),
    description: varchar("description", { length: 255 }),
    author: varchar("author", { length: 150 }),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("plugins_slug_unq").on(t.slug)],
);
export type PluginRow = typeof plugins.$inferSelect;

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
