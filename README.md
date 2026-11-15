# Pixellize CMS

A modular, self-hosted CMS built with Node.js, TypeScript, React and MySQL.
Runs on shared-hosting Node.js environments and VPS/cloud alike.

> **Status:** Phases 1–3 complete. Phase 1: monorepo, Fastify API, MySQL +
> Drizzle, cookie-session auth (Argon2id), protected React admin dashboard.
> Phase 2: Posts/Pages (TipTap editor), Categories, Tags, Media library (Sharp),
> SEO/OG meta, drafts/scheduled publishing, autosave + revisions.
> Phase 3: React SSR public website with themes, menus, site settings, sitemap +
> robots. Single process serves public site at `/`, admin at `/admin`, API at `/api`.

## Stack

- **Backend:** Fastify 5, TypeScript, Drizzle ORM, MySQL (`mysql2`)
- **Admin:** React 19, Vite, Tailwind CSS v4, React Router 8 (TailAdmin base)
- **Auth:** Argon2id password hashing, DB-backed sessions, signed httpOnly cookies
- **Validation:** Zod · **Tests:** Vitest · **Monorepo:** pnpm workspaces

## Project layout

```
pixellize-cms/
├── apps/
│   ├── server/     Fastify: API + SSR public site + serves admin build (single process)
│   ├── admin/      React admin dashboard (TailAdmin), served at /admin
│   └── frontend/   React SSR public website + default theme
├── packages/
│   ├── core/       Env config (zod) + shared types
│   ├── database/   Drizzle schema, client, migrations, seed
│   └── auth/       Argon2id hashing + session/user services (HTTP-independent)
└── .env            Environment configuration (copy from .env.example)
```

> Phase 2+ packages (content, media, seo, theme-engine, plugin-engine, …) are
> added when their phase begins — not pre-scaffolded.

## Prerequisites

- **Node.js** >= 20 (tested on 25)
- **pnpm** 9 — `corepack enable pnpm` (or `npm i -g pnpm`)
- **MySQL** >= 8 running locally (or a reachable MySQL instance)

## Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create the database
mysql -u root -e "CREATE DATABASE pixellize_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 3. Configure environment
cp .env.example .env
#   then edit .env — set DATABASE_URL and a real SESSION_SECRET:
#   openssl rand -hex 32

# 4. Run migrations + seed default roles
pnpm db:migrate
pnpm db:seed
```

## Development

```bash
pnpm dev          # runs API + admin together (parallel)
# or separately:
pnpm dev:server   # Fastify on http://localhost:3000
pnpm dev:admin    # Vite on http://localhost:5173 (proxies /api -> server)
```

Open **http://localhost:5173**. On first run the app shows the registration
screen — the first account you create becomes the **admin**. After that,
self-registration is closed (user management arrives in Phase 2).

## URL structure (single process)

| Path         | Serves                                             |
| ------------ | -------------------------------------------------- |
| `/`          | Public website (React SSR via active theme)        |
| `/blog/:slug`| A published post                                   |
| `/:slug`     | A published page                                   |
| `/category/:slug`, `/tag/:slug` | Archives                        |
| `/admin`     | Admin dashboard (React SPA)                        |
| `/api/*`     | REST API                                           |
| `/uploads/*` | Uploaded media · `/sitemap.xml` · `/robots.txt`    |

## Production (single process — shared-hosting friendly)

```bash
pnpm build        # builds admin (-> /admin) + public site SSR + typechecks
pnpm start        # one Fastify process: public site + /admin + /api (HOST/PORT from .env)
```

In dev, `pnpm dev` runs the API (tsx watch), the admin at **http://localhost:5173/admin/**,
and the public-site SSR build in watch mode (served by the API at **http://localhost:3000/**).

No Redis, no background worker required. Scheduled publishing (Phase 2+) is
designed to run via a cron-invoked endpoint for hosts without persistent workers.

## Tests

```bash
pnpm test                       # all packages
pnpm --filter @pixellize/auth test     # unit: password hashing
pnpm --filter @pixellize/server test   # integration: auth flow + health (needs MySQL)
```

The server integration test uses a separate database (`pixellize_cms_test`,
override with `TEST_DATABASE_URL`) which it creates and migrates automatically.

## Environment variables

| Var                  | Default                                      | Purpose                              |
| -------------------- | -------------------------------------------- | ------------------------------------ |
| `NODE_ENV`           | `development`                                | `development` \| `test` \| `production` |
| `HOST`               | `0.0.0.0`                                    | Bind host                            |
| `PORT`               | `3000`                                       | Bind port                            |
| `ADMIN_ORIGIN`       | `http://localhost:5173`                      | Dev CORS origin for the admin        |
| `DATABASE_URL`       | `mysql://root@localhost:3306/pixellize_cms`  | MySQL connection string              |
| `SESSION_SECRET`     | —                                            | Cookie signing secret (>= 32 chars)  |
| `SESSION_COOKIE_NAME`| `pcms_session`                               | Session cookie name                  |
| `SESSION_TTL_DAYS`   | `7`                                          | Session lifetime (days)              |

## API (Phase 1)

| Method | Route                     | Auth | Purpose                          |
| ------ | ------------------------- | ---- | -------------------------------- |
| GET    | `/api/health`             | —    | Liveness + DB check              |
| GET    | `/api/auth/setup-status`  | —    | Whether first-admin setup needed |
| POST   | `/api/auth/register`      | —    | Create first admin (then closed) |
| POST   | `/api/auth/login`         | —    | Log in, set session cookie       |
| POST   | `/api/auth/logout`        | —    | Destroy session                  |
| GET    | `/api/auth/me`            | ✓    | Current user                     |
| GET    | `/api/dashboard/stats`    | ✓    | Totals + recent posts/users      |

### API (Phase 2)

| Method | Route                          | Purpose                                    |
| ------ | ------------------------------ | ------------------------------------------ |
| GET/POST | `/api/posts`                 | List (`?type=post\|page&status=&search=`) / create |
| GET/PATCH/DELETE | `/api/posts/:id`     | Read / update / delete                     |
| POST   | `/api/posts/:id/autosave`      | Autosave draft + revision                  |
| GET    | `/api/posts/:id/revisions`     | Revision history                           |
| GET/POST | `/api/categories`            | List / create                              |
| PATCH/DELETE | `/api/categories/:id`    | Update / delete                            |
| GET/POST | `/api/tags`                  | List / create                              |
| PATCH/DELETE | `/api/tags/:id`          | Update / delete                            |
| GET/POST | `/api/media`                 | List / upload (multipart)                  |
| PATCH/DELETE | `/api/media/:id`         | Update alt text / delete                   |
| POST   | `/api/cron/publish-scheduled`  | Flip due scheduled posts (needs `x-cron-secret`) |

All Phase 2 routes require auth except the cron endpoint (shared-secret header).
**Posts and Pages share one table** (`type` column) for a reusable model that
extends to Custom Post Types. Media served from `/uploads/*`.

Cron for scheduled publishing (every 5 min):
```
*/5 * * * * curl -s -H "x-cron-secret: $CRON_SECRET" -X POST http://localhost:3000/api/cron/publish-scheduled
```

## License

See `apps/admin/LICENSE.md` for the admin template license (TailAdmin).
