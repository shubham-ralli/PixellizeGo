import { BoxIcon, GearIcon, LayoutGridIcon, PageIcon, PieChartIcon, PluginIcon, UserCircleIcon } from "@/icons";
import type { NavItem } from "./types";

export const navItems: NavItem[] = [
  {
    icon: <LayoutGridIcon className="size-6" />,
    key: "dashboard",
    path: "/",
  },
  {
    icon: <PageIcon className="size-6" />,
    key: "posts",
    subItems: [
      { key: "allPosts", path: "/posts" },
      { key: "categories", path: "/categories" },
      { key: "tags", path: "/tags" },
    ],
  },
  {
    icon: <PageIcon className="size-6" />,
    key: "pages",
    path: "/pages",
  },
  {
    icon: <BoxIcon className="size-6" />,
    key: "media",
    path: "/media",
  },
  {
    icon: <PluginIcon className="size-6" />,
    key: "appearance",
    subItems: [
      { key: "menus", path: "/menus" },
      { key: "themes", path: "/themes" },
    ],
  },
  {
    icon: <PieChartIcon className="size-6" />,
    key: "seo",
    subItems: [
      { key: "seoSettings", path: "/seo" },
      { key: "redirects", path: "/redirects" },
    ],
  },
  {
    icon: <UserCircleIcon className="size-6" />,
    key: "users",
    path: "/users",
  },
  {
    icon: <GearIcon className="size-6" />,
    key: "settings",
    path: "/settings",
  },
];

export const othersItems: NavItem[] = [];

export const supportItems: NavItem[] = [];
