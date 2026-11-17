import type { ReactNode } from "react";
import type { MenuLink, SiteInfo } from "@theme-api";

/** Recursively render a menu item and any nested children (flyout submenus). */
function NavNode({ item, top }: { item: MenuLink; top: boolean }) {
  const hasKids = !!item.children && item.children.length > 0;
  if (!hasKids) {
    return (
      <a href={item.url} className={top ? "site-nav__item" : "site-nav__sublink"}>
        {item.label}
      </a>
    );
  }
  return (
    <div className={`${top ? "site-nav__item" : "site-nav__sublink"} has-children`}>
      <a href={item.url}>
        {item.label}
        {!top && <span className="site-nav__caret"> ›</span>}
      </a>
      <div className={top ? "site-nav__submenu" : "site-nav__submenu site-nav__submenu--nested"}>
        {item.children!.map((c) => (
          <NavNode key={c.url + c.label} item={c} top={false} />
        ))}
      </div>
    </div>
  );
}

export function Layout({
  site,
  menu,
  footerMenu = [],
  children,
}: {
  site: SiteInfo;
  menu: MenuLink[];
  footerMenu?: MenuLink[];
  children: ReactNode;
}) {
  return (
    <div className="site">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <div className="container site-header__inner">
          <a className="site-brand" href="/">
            {site.logo ? (
              <img className="site-logo" src={site.logo} alt={site.title || "Pixellize"} />
            ) : (
              site.title || "Pixellize"
            )}
          </a>
          <nav className="site-nav" aria-label="Primary">
            {menu.map((m) => (
              <NavNode key={m.url + m.label} item={m} top />
            ))}
            <form className="site-search" action="/search" method="get" role="search">
              <input className="site-search__input" type="search" name="q" placeholder="Search…" aria-label="Search" />
            </form>
          </nav>
        </div>
      </header>

      <main className="site-main" id="main">
        <div className="container">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="container site-footer__inner">
          <div className="site-footer__brand">
            {site.title || "Pixellize"}
            {site.tagline && <span>{site.tagline}</span>}
          </div>
          {footerMenu.length > 0 && (
            <nav className="site-footer__nav" aria-label="Footer">
              {footerMenu.map((m) => (
                <a key={m.url + m.label} href={m.url}>
                  {m.label}
                </a>
              ))}
            </nav>
          )}
          <div className="site-footer__copy">
            © {new Date().getFullYear()} {site.title || "Pixellize"}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
