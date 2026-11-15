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
            {menu.map((m) =>
              m.children && m.children.length > 0 ? (
                <div key={m.url + m.label} className="site-nav__item has-children">
                  <a href={m.url}>{m.label}</a>
                  <div className="site-nav__submenu">
                    {m.children.map((c) => (
                      <a key={c.url + c.label} href={c.url}>
                        {c.label}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <a key={m.url + m.label} href={m.url} className="site-nav__item">
                  {m.label}
                </a>
              ),
            )}
          </nav>
        </div>
      </header>

      <main className="site-main">
        <div className="container">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            {site.title || "Pixellize"}
            {site.tagline && <span>{site.tagline}</span>}
          </div>
          <div className="site-footer__copy">
            © {new Date().getFullYear()} {site.title || "Pixellize"}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
