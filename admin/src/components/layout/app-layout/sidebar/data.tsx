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
      { key: "allPosts", path: "/content/post" },
      { key: "categories", path: "/taxonomy/category" },
      { key: "tags", path: "/taxonomy/tag" },
    ],
  },
  {
    icon: <PageIcon className="size-6" />,
    key: "pages",
    path: "/content/page",
  },
  {
    icon: <BoxIcon className="size-6" />,
    key: "media",
    path: "/media",
  },
  {
    icon: <PageIcon className="size-6" />,
    key: "comments",
    path: "/comments",
  },
  {
    icon: <PluginIcon className="size-6" />,
    key: "appearance",
    subItems: [
      { key: "menus", path: "/menus" },
      { key: "themes", path: "/themes" },
      { key: "plugins", path: "/plugins" },
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
    subItems: [
      { key: "generalSettings", path: "/settings" },
      { key: "readingSettings", path: "/settings/reading" },
    ],
  },
];

export const othersItems: NavItem[] = [];

export const supportItems: NavItem[] = [];
