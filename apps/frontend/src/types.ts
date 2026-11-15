export type View = "home" | "single" | "page" | "archive" | "notfound";

export interface SiteInfo {
  title: string;
  tagline: string;
  baseUrl: string;
}

export interface MenuLink {
  label: string;
  url: string;
  children?: MenuLink[];
}

export interface PostView {
  id: number;
  type: "post" | "page";
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  author: { id: number; name: string } | null;
  featuredMedia: { url: string; altText: string | null } | null;
  terms: { name: string; slug: string; taxonomy: string; route: string }[];
}

export interface ListItemView {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featuredUrl: string | null;
  authorName: string | null;
  publishedAt: string | null;
}

export interface AdminBar {
  user: string;
  dashboardUrl: string;
  newPostUrl: string;
  logoutUrl: string;
  editUrl: string | null;
}

export interface PageContext {
  view: View;
  title?: string;
  adminBar?: AdminBar;
  site: SiteInfo;
  menu: MenuLink[];
  themeSettings: Record<string, unknown>;
  post?: PostView;
  posts?: ListItemView[];
  archive?: { label: string; name: string; slug: string };
}
