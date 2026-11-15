import { apiFetch } from "./api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type PostType = string; // a post type slug — "post", "page", or any custom type
export type PostStatus = "draft" | "published" | "scheduled";

// Origin of the public website. Same-origin in prod (admin + site served together);
// override with VITE_SITE_URL in dev (admin and site run on different ports).
const SITE_ORIGIN =
  import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

/** Public front-end URL for a post, from its post type's route prefix ("blog", "", …). */
export function publicUrl(route: string, slug: string): string {
  return `${SITE_ORIGIN}${route ? `/${route}` : ""}/${slug}`;
}

/** Absolute public URL for a ready-made path (e.g. a post's nested path "/demo/page-1"). */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`;
}

export interface MediaItem {
  id: number;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  altText: string | null;
  createdAt: string;
}

export interface PostListItem {
  id: number;
  type: PostType;
  title: string;
  slug: string;
  parentId: number | null;
  path: string;
  status: PostStatus;
  authorName: string | null;
  featuredUrl: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  updatedAt: string;
}

export interface PostDTO {
  id: number;
  type: PostType;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  status: PostStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  featuredMedia: { id: number; url: string; altText: string | null } | null;
  author: { id: number; name: string } | null;
  parentId: number | null;
  path: string;
  terms: { id: number; name: string; slug: string; taxonomy: string; taxonomyLabel: string; route: string }[];
  meta: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface PostTypeDef {
  id: number;
  slug: string;
  label: string;
  labelPlural: string;
  route: string;
  hierarchical: boolean;
  hasArchive: boolean;
  builtIn: boolean;
  postCount: number;
}

export interface Taxonomy {
  id: number;
  slug: string;
  label: string;
  labelPlural: string;
  route: string;
  hierarchical: boolean;
}

export interface Term {
  id: number;
  taxonomyId: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  postCount: number;
}

export interface PostInput {
  type?: PostType;
  title: string;
  slug?: string;
  excerpt?: string | null;
  content?: string | null;
  status?: PostStatus;
  scheduledAt?: string | null;
  featuredMediaId?: number | null;
  parentId?: number | null;
  termIds?: number[];
  meta?: Record<string, string>;
}

/* Posts */
export function listPosts(params: {
  type?: PostType;
  status?: PostStatus;
  search?: string;
  trashed?: boolean;
  limit?: number;
  offset?: number;
}): Promise<{ items: PostListItem[]; total: number }> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue;
    qs.set(k, v === true ? "1" : String(v));
  }
  return apiFetch(`/api/posts?${qs.toString()}`);
}
export const getPost = (id: number) => apiFetch<PostDTO>(`/api/posts/${id}`);
export const createPost = (body: PostInput) =>
  apiFetch<PostDTO>("/api/posts", { method: "POST", body: JSON.stringify(body) });
export const updatePost = (id: number, body: PostInput) =>
  apiFetch<PostDTO>(`/api/posts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
/** Soft delete (move to trash). */
export const trashPost = (id: number) => apiFetch(`/api/posts/${id}`, { method: "DELETE" });
export const restorePost = (id: number) => apiFetch(`/api/posts/${id}/restore`, { method: "POST", body: "{}" });
export const forceDeletePost = (id: number) => apiFetch(`/api/posts/${id}/force`, { method: "DELETE" });
export const bulkPosts = (action: "trash" | "restore" | "delete", ids: number[]) =>
  apiFetch<{ affected: number }>("/api/posts/bulk", { method: "POST", body: JSON.stringify({ action, ids }) });
export const autosavePost = (id: number, patch: { title?: string; content?: string | null }) =>
  apiFetch<{ savedAt: string }>(`/api/posts/${id}/autosave`, {
    method: "POST",
    body: JSON.stringify(patch),
  });
export const listRevisions = (id: number) =>
  apiFetch<{ id: number; title: string; kind: string; createdAt: string }[]>(`/api/posts/${id}/revisions`);

/* Post types (generic — posts, pages, and any custom post type) */
export type PostTypeInput = { slug?: string; label: string; labelPlural: string; route?: string; hasArchive?: boolean };
export const listPostTypes = () => apiFetch<PostTypeDef[]>("/api/post-types");
export const createPostType = (body: PostTypeInput) =>
  apiFetch<PostTypeDef>("/api/post-types", { method: "POST", body: JSON.stringify(body) });
export const updatePostType = (id: number, body: PostTypeInput) =>
  apiFetch<PostTypeDef>(`/api/post-types/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deletePostType = (id: number) => apiFetch(`/api/post-types/${id}`, { method: "DELETE" });

/* Taxonomies & terms (generic — categories, tags, and any future taxonomy) */
export type TermInput = { name: string; slug?: string; description?: string | null };

export const listTaxonomies = () => apiFetch<Taxonomy[]>("/api/taxonomies");
export const listTerms = (tax: string) => apiFetch<Term[]>(`/api/taxonomies/${tax}/terms`);
export const createTerm = (tax: string, body: TermInput) =>
  apiFetch<Term>(`/api/taxonomies/${tax}/terms`, { method: "POST", body: JSON.stringify(body) });
export const updateTerm = (id: number, body: TermInput) =>
  apiFetch<Term>(`/api/terms/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteTerm = (id: number) => apiFetch(`/api/terms/${id}`, { method: "DELETE" });

/* Media */
export const listMedia = (params: { limit?: number; offset?: number } = {}) => {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
  return apiFetch<{ items: MediaItem[]; total: number }>(`/api/media?${qs.toString()}`);
};
export async function uploadMedia(file: File): Promise<MediaItem> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/api/media`, { method: "POST", credentials: "include", body: form });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message ?? "Upload failed");
  return body as MediaItem;
}
export const updateMediaAlt = (id: number, altText: string) =>
  apiFetch(`/api/media/${id}`, { method: "PATCH", body: JSON.stringify({ altText }) });
export const deleteMedia = (id: number) => apiFetch(`/api/media/${id}`, { method: "DELETE" });

/* Profile */
export const updateProfile = (body: {
  name?: string;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
}) => apiFetch<{ user: unknown }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(body) });

/* Users */
export type UserRole = "admin" | "editor" | "author";
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  bio: string | null;
  website: string | null;
  role: UserRole;
  avatarUrl: string | null;
  status: "active" | "disabled";
  createdAt: string;
}
export const listUsers = () => apiFetch<AdminUser[]>("/api/users");
export const createUser = (body: {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  bio?: string | null;
  website?: string | null;
  avatarUrl?: string | null;
  status?: "active" | "disabled";
}) => apiFetch<{ id: number }>("/api/users", { method: "POST", body: JSON.stringify(body) });
export const updateUser = (
  id: number,
  body: {
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    bio?: string | null;
    website?: string | null;
    avatarUrl?: string | null;
    role?: UserRole;
    status?: "active" | "disabled";
    password?: string;
  },
) => apiFetch(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteUser = (id: number) => apiFetch(`/api/users/${id}`, { method: "DELETE" });

/* Redirects */
export interface Redirect {
  id: number;
  fromPath: string;
  toPath: string;
  statusCode: number;
  createdAt: string;
}
export const listRedirects = () => apiFetch<Redirect[]>("/api/redirects");
export const createRedirect = (body: { fromPath: string; toPath: string; statusCode?: 301 | 302 }) =>
  apiFetch<Redirect>("/api/redirects", { method: "POST", body: JSON.stringify(body) });
export const deleteRedirect = (id: number) => apiFetch(`/api/redirects/${id}`, { method: "DELETE" });

/* Settings */
export const getSettings = () => apiFetch<Record<string, string>>("/api/settings");
export const saveSettings = (values: Record<string, string>) =>
  apiFetch("/api/settings", { method: "PUT", body: JSON.stringify(values) });

/* Menus */
export interface MenuLink {
  label: string;
  url: string;
  children?: MenuLink[];
}
export interface Menu {
  id: number;
  name: string;
  location: string | null;
  items: MenuLink[];
}
export const listMenus = () => apiFetch<Menu[]>("/api/menus");
export const createMenu = (body: { name: string; location?: string | null; items?: MenuLink[] }) =>
  apiFetch<Menu>("/api/menus", { method: "POST", body: JSON.stringify(body) });
export const updateMenu = (id: number, body: { name?: string; location?: string | null; items?: MenuLink[] }) =>
  apiFetch<Menu>(`/api/menus/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteMenu = (id: number) => apiFetch(`/api/menus/${id}`, { method: "DELETE" });

/* Themes */
export interface Theme {
  id: number;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  isActive: boolean;
}
export const listThemes = () => apiFetch<Theme[]>("/api/themes");
export const activateTheme = (slug: string) =>
  apiFetch(`/api/themes/${slug}/activate`, { method: "POST", body: JSON.stringify({}) });
