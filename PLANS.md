# Pixellize CMS — Plans & Status

A self-hosted, modular, WordPress-style CMS.

**Stack:** Node.js · TypeScript · Fastify 5 · Drizzle ORM · MySQL · React 19 · Vite · Tailwind v4 (admin) · React SSR + hydration (public site) · pnpm monorepo.

**Layout:**
- `apps/server` — Fastify API + static hosting (admin SPA at `/admin`, public SSR site at `/`)
- `apps/admin` — React admin dashboard (TailAdmin-based)
- `apps/frontend` — React SSR public site + themes
- `packages/*` — `core`, `database`, `auth`, `content`, `media`, `storage`, `theme-engine`, `seo`

Dev run: server on `:3001` via `tsx` (no build step); admin + frontend built into `apps/server/public` and `apps/server/ssr`.

---

## ✅ Done

### Foundation & auth
- First-admin registration (bootstrap), login, logout, session cookies (hashed tokens, TTL).
- Role model: `admin` / `editor` / `author`; role-guarded routes.
- Profile: first name, last name, display name, website, **bio (rich text: bold/link)**, avatar (media picker). View + dedicated edit page (`/admin/profile`, `/admin/profile/edit`).

### Content (posts, pages, custom types)
- Posts & pages CRUD with draft / published / **scheduled** (cron endpoint flips due posts).
- Autosave + revisions.
- Soft delete (trash) → restore → permanent delete; bulk actions.
- **Generic post types** — registry table (`post_types`); `post` and `page` are built-in rows. `type` is a slug, not an enum. Generic admin at `/content/:type`.
- **Hierarchical pages** — parent/child with nested public URLs (`/demo/page-1`); bare child slug 404s to keep one canonical URL. Parent picker in the page editor.
- SEO/Open Graph per post: meta title (with `%title% %sep% %sitename% %category%` variables), description, slug, canonical, OG fields — with length meters and live URL preview.
- **Editor extras**: insert **images** into the rich text editor via the Media Library picker; **duplicate** a post/page as a draft copy; **preview** the current unsaved draft in a modal; **revisions** panel to view an earlier revision and **restore** it.

### Search
- Public **`/search`** page: header search box + on-page form, searches published posts across **title, excerpt and content**, renders a result grid (with "no results" / empty states). `noindex`.
- Admin content search (Posts/Pages list) now matches **body content and excerpt**, not just the title.

### Pagination
- Home feed, taxonomy archives, and search results paginate via **`?page=N`** (9 per page), with real total counts and a windowed prev/next + numbered pager in the theme. Page 1 of the home feed keeps the hero + featured; later pages are a plain grid.

### Comments
- Visitor comment form on blog posts (name, email, comment) → lands as **pending**.
- **Moderation queue** at `/admin/comments` — filter by status (pending/approved/spam/trash), approve/unapprove/spam/trash/delete, bulk actions.
- Only **approved** comments render publicly; email is never exposed. Comments cascade-delete with their post.

### Taxonomy
- **Generic taxonomy + terms** system (`taxonomies`, `terms`, `post_terms`). `category` (hierarchical) and `tag` are seeded rows; add a taxonomy = insert a row.
- Term manager at `/taxonomy/:tax`.
- In the post editor: categories as checkboxes **with inline "add new"**, tags as a **multi-tag chips input** that creates missing terms.

### Media
- Upload, list, alt-text edit, delete. Bulk select + delete. Detail modal deep-linked via `?item=`.
- **Thumbnails**: on upload, a 400px WebP thumbnail is generated (sharp) and used in all grids (library + picker) for fast loading; cleaned up on delete.
- **Filtering**: media library + picker filter by type (All / Images / Documents) and search by filename.
- Reusable **WordPress-style MediaPicker** modal (used for featured image, avatars), with drag-and-drop upload.

### Website engine
- **Themes** — active theme stored in DB; metadata read WordPress-style from the `style.css` header comment (no `theme.json`). Admin Themes gallery (card thumbnails, activate).
- **Menus** — WordPress-style builder: left "Add menu items" (checkbox multi-add from pages/posts/terms + custom links), right "Menu structure" with **drag-and-drop reordering** (subtree-aware, native HTML5 DnD) and **indent/outdent nesting up to 3 levels**. Assign a menu to a **location** (Primary / Footer); the theme renders the Primary menu as the header nav (with nested flyout dropdowns) and the Footer menu in the footer.
- **Settings** (general + reading), **Redirects** (301/302), **SEO defaults**.
- **Users** admin — list + dedicated create/edit pages with full profile fields; role/status inline; bulk delete; last-admin / self-delete guards.

### Public site (SSR)
- React SSR + hydration; client-side navigation via `?__json=1` fetch (no full reload).
- Views: home (hero + featured + card grid), single (blog post), page, taxonomy archive, 404.
- **"Default" editorial theme** — serif/sans type system, responsive, dark-mode aware.
- **Sitemap** — a single `sitemap.xml` for small sites that automatically becomes a **sitemap index** of paginated `sitemap-N.xml` files once the site passes 1000 URLs; robots.txt.
- **Breadcrumb JSON-LD** (`BreadcrumbList`) on single posts (Home → Category → Post), pages, and taxonomy archives.
- **Social share card preview** in the editor's SEO panel (Open Graph image/title/description/domain), alongside the search-result preview.
- **Server-driven admin toolbar** (`pcms-admin-bar`) shown only to logged-in viewers: Dashboard / Edit this page / New, plus a user dropdown with avatar and Log out.

### Shared admin UI
- Generic `DataTable` (selection, right-aligned search, pagination, bulk actions) used across lists.
- Dashboard with content counts.

### Accessibility
- Theme: skip-to-content link, `<main>` landmark, labelled navs, **keyboard-accessible menu dropdowns** (focus-within), visible focus rings, labelled comment/search inputs, `lang` set.
- Admin: keyboard reorder (↑/↓) in the menu builder, `aria-label`s on icon-only controls, `role="dialog"`/`aria-modal`/Escape on editor modals, labelled search inputs and row checkboxes.
- (A full WCAG audit — contrast, screen-reader testing, keyboard-equivalent drag-drop — is still a follow-up.)

### Quality
- 31 server integration tests pass (auth, content lifecycle, taxonomy, custom types, hierarchical pages).
- Whole-workspace typecheck clean. Single baseline Drizzle migration. `.gitignore` excludes secrets/uploads/builds.

---

## 🚧 Partial / rough edges

- **Theme switching** activates a DB row, but the public frontend only renders the bundled `default` theme — no dynamic multi-theme component loading yet.
- **Menu nesting** capped at 3 levels; order is drag-and-drop but depth change is still buttons (→ ←), not drag-to-nest. Only Primary/Footer locations (not theme-declared).
- **Post types UI** — the admin "Post Types" management screen was removed; custom types are added via DB/seed. Custom types default to non-hierarchical.
- **i18n** — sidebar strings only fully present in `en.json`; other locales fall back.
- **Scheduled publishing** relies on an external cron hitting the endpoint; no built-in scheduler.
- **Theme settings** (e.g. accent color) are stored but not wired into the theme.

---

## 📋 To-do (should-have, roughly prioritized)

1. **Comments v2** — deeper threading + public visitor replies, Markdown/sanitized HTML, spam/honeypot protection, email notifications, per-post "allow comments" toggle.
2. **Search v2** — relevance ranking, search across all post types + terms, highlighting, maybe a real full-text index.
3. **Dynamic theme loading** — render the active theme's components, theme settings (colors/fonts) applied live, theme install/upload.
4. **Menus v2** — theme-declared locations (beyond the fixed Primary/Footer), full drag-to-nest (change depth by dragging), menu item target/CSS-class options.
5. **Media v2**: folders / organization, focal point + on-the-fly crops, multiple named sizes, CDN/offload, replace-file.
6. **Editor v2**: oEmbed/embed blocks (YouTube, tweets, etc.), visual side-by-side revision **diff**, image alignment/resize handles, tables.
7. **Roles/permissions**: finer capabilities (author can only edit own posts), invite-by-email flow.
8. **SEO v2**: Article/Organization/WebSite JSON-LD, news/image/video sitemaps, redirect suggestions for changed slugs, per-page robots controls UI.
9. **Custom fields / meta boxes** per post type.
10. **Internationalization**: complete all four locales; content-level i18n if needed.
11. **Ops**: real scheduler for scheduled posts, backups, import/export (WXR), rate limiting, audit log.
12. **Testing**: admin component/e2e tests; frontend SSR tests.
13. **Accessibility v2** — full WCAG 2.1 AA audit: colour-contrast tokens, screen-reader testing (NVDA/VoiceOver), keyboard-equivalent drag-and-drop, reduced-motion, form error announcements.

---

## Dev notes

- Run server: `cd apps/server && NODE_ENV=production corepack pnpm start` (serves built admin + SSR site on `:3001`).
- Rebuild after admin changes: `corepack pnpm --filter @pixellize/admin build`; after theme/public changes: `--filter @pixellize/frontend build:client` **and** `build:server` (restart server to pick up SSR).
- Nested `pnpm` in scripts fails under corepack — run `corepack pnpm --filter <pkg> <script>` directly.
- Migrations are a single regenerated baseline; apply schema deltas to the dev DB (`pixellize_cms`) by hand, and drop the test DB's tables before re-running tests after a baseline change.
