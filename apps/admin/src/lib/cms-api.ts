import { apiFetch } from "./api";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type PostType = "post" | "page";
export type PostStatus = "draft" | "published" | "scheduled";

// Origin of the public website. Same-origin in prod (admin + site served together);
// override with VITE_SITE_URL in dev (admin and site run on different ports).
const SITE_ORIGIN =
  import.meta.env.VITE_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "");

/** Public front-end URL for a post (/blog/:slug) or page (/:slug). */
export function publicUrl(type: PostType, slug: string): string {
  return `${SITE_ORIGIN}${type === "page" ? "" : "/blog"}/${slug}`;
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
  categories: { id: number; name: string; slug: string }[];
  tags: { id: number; name: string; slug: string }[];
  meta: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parentId: number | null;
  postCount: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
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
  categoryIds?: number[];
  tagIds?: number[];
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

/* Categories */
export type CategoryInput = { name: string; slug?: string; description?: string | null };
export type TagInput = { name: string; slug?: string };

export const listCategories = () => apiFetch<Category[]>("/api/categories");
export const createCategory = (body: CategoryInput) =>
  apiFetch<Category>("/api/categories", { method: "POST", body: JSON.stringify(body) });
export const updateCategory = (id: number, body: CategoryInput) =>
  apiFetch<Category>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteCategory = (id: number) => apiFetch(`/api/categories/${id}`, { method: "DELETE" });

/* Tags */
export const listTags = () => apiFetch<Tag[]>("/api/tags");
export const createTag = (body: TagInput) =>
  apiFetch<Tag>("/api/tags", { method: "POST", body: JSON.stringify(body) });
export const updateTag = (id: number, body: TagInput) =>
  apiFetch<Tag>(`/api/tags/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteTag = (id: number) => apiFetch(`/api/tags/${id}`, { method: "DELETE" });

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
export const updateProfile = (body: { name?: string; avatarUrl?: string | null }) =>
  apiFetch<{ user: unknown }>("/api/auth/profile", { method: "PATCH", body: JSON.stringify(body) });

/* Users */
export type UserRole = "admin" | "editor" | "author";
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl: string | null;
  status: "active" | "disabled";
  createdAt: string;
}
export const listUsers = () => apiFetch<AdminUser[]>("/api/users");
export const createUser = (body: { email: string; name: string; password: string; role: UserRole }) =>
  apiFetch<{ id: number }>("/api/users", { method: "POST", body: JSON.stringify(body) });
export const updateUser = (
  id: number,
  body: { name?: string; role?: UserRole; status?: "active" | "disabled"; password?: string },
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
