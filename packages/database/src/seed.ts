import { closeDb, getDb } from "./client.js";
import { menus, postTypes, roles, settings, taxonomies, themes } from "./schema.js";

const DEFAULT_ROLES = [
  { name: "admin", description: "Full access to everything" },
  { name: "editor", description: "Create and publish any content" },
  { name: "author", description: "Create and manage own content" },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  siteTitle: "Pixellize",
  tagline: "A modern self-hosted CMS",
  siteUrl: "",
  postsPerPage: "12",
};

async function main(): Promise<void> {
  const db = getDb();

  for (const r of DEFAULT_ROLES) {
    await db.insert(roles).values(r).onDuplicateKeyUpdate({ set: { description: r.description } });
  }

  // Default theme (active).
  await db
    .insert(themes)
    .values({ slug: "default", name: "Default", version: "1.0.0", description: "The default Pixellize theme.", isActive: true })
    .onDuplicateKeyUpdate({ set: { name: "Default", version: "1.0.0" } });

  // Site settings (only insert if missing, don't clobber edits).
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(settings).values({ key, value }).onDuplicateKeyUpdate({ set: { key } });
  }

  // Built-in post types. Add custom types via the admin Post Types screen (or a row here).
  const DEFAULT_POST_TYPES = [
    { slug: "post", label: "Post", labelPlural: "Posts", route: "blog", hierarchical: false, hasArchive: false, builtIn: true },
    { slug: "page", label: "Page", labelPlural: "Pages", route: "", hierarchical: true, hasArchive: false, builtIn: true },
  ];
  for (const pt of DEFAULT_POST_TYPES) {
    await db
      .insert(postTypes)
      .values(pt)
      .onDuplicateKeyUpdate({
        set: { label: pt.label, labelPlural: pt.labelPlural, route: pt.route, hierarchical: pt.hierarchical, builtIn: pt.builtIn },
      });
  }

  // Default taxonomies (category, tag). Add more rows here to create new taxonomies.
  const DEFAULT_TAXONOMIES = [
    { slug: "category", label: "Category", labelPlural: "Categories", route: "category", hierarchical: true },
    { slug: "tag", label: "Tag", labelPlural: "Tags", route: "tag", hierarchical: false },
  ];
  for (const tx of DEFAULT_TAXONOMIES) {
    await db
      .insert(taxonomies)
      .values(tx)
      .onDuplicateKeyUpdate({ set: { label: tx.label, labelPlural: tx.labelPlural, route: tx.route } });
  }

  // Primary menu (create once).
  const existingMenu = await db.select({ id: menus.id }).from(menus).limit(1);
  if (existingMenu.length === 0) {
    await db.insert(menus).values({
      name: "Primary",
      location: "primary",
      items: [{ label: "Home", url: "/" }],
    });
  }

  console.log("Seeded roles, default theme, settings, and primary menu.");
  await closeDb();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
