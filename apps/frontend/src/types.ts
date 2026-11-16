export type View = "home" | "single" | "page" | "archive" | "search" | "notfound";

export interface SiteInfo {
  title: string;
  tagline: string;
  baseUrl: string;
  logo?: string;
  icon?: string;
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

export interface CommentView {
  id: number;
  parentId: number | null;
  authorName: string;
  authorUrl: string | null;
  content: string;
  isStaff: boolean;
  createdAt: string;
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
  footerMenu?: MenuLink[];
  themeSettings: Record<string, unknown>;
  post?: PostView;
  posts?: ListItemView[];
  comments?: CommentView[];
  archive?: { label: string; name: string; slug: string };
  searchQuery?: string;
  page?: number;
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  totalPages: number;
  baseUrl: string;
  query?: string; // extra querystring, e.g. "q=foo"
}
