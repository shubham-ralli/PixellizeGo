import { useEffect, useState } from "react";
import { ThemeApp } from "./theme-app";
import type { AdminBar, PageContext } from "./types";

declare global {
  interface Window {
    pcmsUpdateAdminBar?: (bar: AdminBar | undefined) => void;
  }
}

/** WordPress-style <body> classes — mirrors the server's bodyClassFor. */
function bodyClass(ctx: PageContext): string {
  const c: string[] = [];
  const p = ctx.post;
  if (ctx.view === "home") c.push("home");
  else if (ctx.view === "search") c.push("search", "search-results");
  else if (ctx.view === "archive") c.push("archive");
  else if (ctx.view === "notfound") c.push("error404");
  else if (ctx.view === "page" && p) c.push("page", `page-id-${p.id}`, "page-template-default", "type-page", `page-${p.slug}`);
  else if (ctx.view === "single" && p) {
    c.push("single", `single-${p.type}`, `type-${p.type}`, `${p.type}-id-${p.id}`, `${p.type}-${p.slug}`);
    if (p.type === "post") c.push("post");
  }
  return c.join(" ").replace(/[^a-zA-Z0-9_ -]/g, "-");
}

/** Should a link be handled by client-side navigation? */
function internalHref(a: HTMLAnchorElement): string | null {
  const href = a.getAttribute("href");
  if (!href || !href.startsWith("/")) return null; // external, hash, or mailto
  if (a.target && a.target !== "_self") return null;
  if (a.hasAttribute("download")) return null;
  // Not the public site (let the browser do a real request):
  if (/^\/(admin|api|uploads|assets|sitemap|robots)\b/.test(href)) return null;
  return href;
}

export function Root({ initial }: { initial: PageContext }) {
  const [ctx, setCtx] = useState<PageContext>(initial);

  useEffect(() => {
    async function go(href: string, push: boolean) {
      try {
        const url = href + (href.includes("?") ? "&" : "?") + "__json=1";
        const res = await fetch(url, { headers: { accept: "application/json" } });
        const ct = res.headers.get("content-type") ?? "";
        if (!ct.includes("application/json")) {
          window.location.href = href; // not a page route; hard-navigate
          return;
        }
        const next = (await res.json()) as PageContext;
        if (push) history.pushState({}, "", href);
        setCtx(next);
        document.body.className = bodyClass(next);
        if (next.title) document.title = next.title;
        // Admin toolbar is owned by the admin layer (injected by the server), not the theme.
        // Hand it the latest data so it can refresh its "Edit" link after client-side nav.
        window.pcmsUpdateAdminBar?.(next.adminBar);
        window.scrollTo(0, 0);
      } catch {
        window.location.href = href;
      }
    }

    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = internalHref(anchor as HTMLAnchorElement);
      if (!href) return;
      e.preventDefault();
      if (href !== location.pathname + location.search) void go(href, true);
    }

    function onPop() {
      void go(location.pathname + location.search, false);
    }

    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return <ThemeApp ctx={ctx} />;
}
