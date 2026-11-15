import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "admin-bar");

export interface AdminBarData {
  user: string;
  dashboardUrl: string;
  newPostUrl: string;
  logoutUrl: string;
  editUrl: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** HTML to inject into the public page for a logged-in user (CSS link + bar markup + runtime). */
export function renderAdminBarInjection(bar: AdminBarData): { headExtra: string; bodyTop: string } {
  const editStyle = bar.editUrl ? "" : ' style="display:none"';
  const bodyTop = `<div id="pcms-admin-bar"><div class="pcms-admin-bar__inner">
  <div class="pcms-admin-bar__group">
    <a href="${esc(bar.dashboardUrl)}">Dashboard</a>
    <a id="pcms-admin-bar-edit" class="pcms-admin-bar__edit" href="${esc(bar.editUrl ?? "#")}"${editStyle}>✎ Edit this page</a>
    <a href="${esc(bar.newPostUrl)}">+ New Post</a>
  </div>
  <div class="pcms-admin-bar__group">
    <span class="pcms-admin-bar__user">${esc(bar.user)}</span>
    <a href="${esc(bar.logoutUrl)}">Log out</a>
  </div>
</div></div>
<script defer src="/admin-bar/admin-bar.js"></script>`;
  return {
    headExtra: `<link rel="stylesheet" href="/admin-bar/admin-bar.css" />`,
    bodyTop,
  };
}

/** Serve the admin-bar static assets (loaded by the public page only when logged in). */
export async function registerAdminBarAssets(app: FastifyInstance): Promise<void> {
  await app.register(fastifyStatic, {
    root: assetsDir,
    prefix: "/admin-bar/",
    decorateReply: false,
    index: false,
  });
}
