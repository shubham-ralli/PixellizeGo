import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const assetsDir = join(dirname(fileURLToPath(import.meta.url)), "admin-bar");

export interface AdminBarData {
  user: string;
  avatarUrl: string | null;
  dashboardUrl: string;
  newPostUrl: string;
  logoutUrl: string;
  profileUrl: string;
  editUrl: string | null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** HTML to inject into the public page for a logged-in user (CSS link + bar markup + runtime). */
export function renderAdminBarInjection(bar: AdminBarData): { headExtra: string; bodyTop: string } {
  const editStyle = bar.editUrl ? "" : ' style="display:none"';
  const initial = esc((bar.user.trim()[0] ?? "?").toUpperCase());
  const avatar = bar.avatarUrl
    ? `<img class="pcms-ab__avatar" src="${esc(bar.avatarUrl)}" alt="" />`
    : `<span class="pcms-ab__avatar pcms-ab__avatar--initial">${initial}</span>`;

  const bodyTop = `<div id="pcms-admin-bar"><div class="pcms-ab__inner">
  <div class="pcms-ab__group">
    <a class="pcms-ab__brand" href="${esc(bar.dashboardUrl)}">Pixellize</a>
    <a href="${esc(bar.dashboardUrl)}">Dashboard</a>
    <a id="pcms-admin-bar-edit" class="pcms-ab__edit" href="${esc(bar.editUrl ?? "#")}"${editStyle}>✎ Edit</a>
    <a href="${esc(bar.newPostUrl)}">+ New</a>
  </div>
  <div class="pcms-ab__user-wrap">
    <button type="button" class="pcms-ab__user" id="pcms-admin-bar-user" aria-haspopup="true" aria-expanded="false">
      ${avatar}
      <span class="pcms-ab__name">${esc(bar.user)}</span>
      <span class="pcms-ab__caret" aria-hidden="true">▾</span>
    </button>
    <div class="pcms-ab__menu" id="pcms-admin-bar-menu" role="menu">
      <a href="${esc(bar.dashboardUrl)}" role="menuitem">Dashboard</a>
      <a href="${esc(bar.profileUrl)}" role="menuitem">Edit profile</a>
      <a class="pcms-ab__logout" href="${esc(bar.logoutUrl)}" role="menuitem">Log out</a>
    </div>
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
