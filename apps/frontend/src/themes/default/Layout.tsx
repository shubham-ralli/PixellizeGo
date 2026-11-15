import type { ReactNode } from "react";
import type { MenuLink, SiteInfo } from "../../types";

export function Layout({
  site,
  menu,
  children,
}: {
  site: SiteInfo;
  menu: MenuLink[];
  children: ReactNode;
}) {
  return (
    <div className="site">
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="site-brand" href="/">
            {site.title || "Pixellize"}
          </a>
          <nav className="site-nav">
            {menu.map((m) => (
              <a key={m.url + m.label} href={m.url}>
                {m.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="container site-main">{children}</main>

      <footer className="site-footer">
        <div className="container">
          © {new Date().getFullYear()} {site.title || "Pixellize"}
          {site.tagline ? ` — ${site.tagline}` : ""}
        </div>
      </footer>
    </div>
  );
}
