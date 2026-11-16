import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProd } from "@pixellize/core/env";

const here = dirname(fileURLToPath(import.meta.url));
const siteDir = join(here, "..", "public", "site");
const ssrFile = join(here, "..", "ssr", "entry-server.js");
const templatePath = join(siteDir, "index.html");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RenderFn = (ctx: any) => { html: string };

let cachedRender: RenderFn | undefined;
let cachedRenderMtime = 0;

/** Load the built SSR render(). In dev, re-import when the bundle changes. */
async function getRender(): Promise<RenderFn | undefined> {
  if (!existsSync(ssrFile)) return undefined;
  const mtime = statSync(ssrFile).mtimeMs;
  if (!cachedRender || mtime !== cachedRenderMtime) {
    const url = pathToFileURL(ssrFile).href + (isProd ? "" : `?t=${mtime}`);
    const mod = await import(url);
    cachedRender = mod.render as RenderFn;
    cachedRenderMtime = mtime;
  }
  return cachedRender;
}

let cachedTemplate: string | undefined;
function getTemplate(): string | undefined {
  if (!existsSync(templatePath)) return undefined;
  if (!cachedTemplate || !isProd) cachedTemplate = readFileSync(templatePath, "utf8");
  return cachedTemplate;
}

export function frontendBuilt(): boolean {
  return existsSync(ssrFile) && existsSync(templatePath);
}

function serializeData(data: unknown): string {
  // Escape "<" to prevent breaking out of the <script> tag.
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface RenderInject {
  headExtra?: string; // extra tags for <head> (e.g. admin-bar CSS)
  bodyTop?: string; // markup injected before #app (e.g. admin-bar, injected by the server)
  bodyClass?: string; // WordPress-style classes for the <body> element
}

/** Render a page: inject SEO head, SSR body HTML, and hydration data into the template. */
export async function renderPage(
  ctx: unknown,
  headTags: string,
  inject: RenderInject = {},
): Promise<string | undefined> {
  const render = await getRender();
  const template = getTemplate();
  if (!render || !template) return undefined;
  const { html } = render(ctx);
  const dataScript = `<script>window.__PAGE__=${serializeData(ctx)}</script>`;
  return template
    .replace("<!--app-head-->", headTags + (inject.headExtra ?? ""))
    .replace("<body>", inject.bodyClass ? `<body class="${inject.bodyClass}">` : "<body>")
    .replace('<div id="app">', `${inject.bodyTop ?? ""}<div id="app">`)
    .replace("<!--app-html-->", html)
    .replace("<!--app-data-->", dataScript);
}

/** Fallback page when the frontend hasn't been built yet. */
export function notBuiltPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Pixellize CMS</title></head>
<body style="font-family:system-ui;max-width:640px;margin:80px auto;padding:0 16px;color:#1f2937">
<h1>Frontend not built</h1>
<p>Run <code>pnpm --filter @pixellize/frontend build</code> (or <code>pnpm build</code>) to build the public site, then reload.</p>
<p>The admin dashboard is at <a href="/admin">/admin</a>.</p>
</body></html>`;
}
