import "./themes/default/style.css";
import { Archive } from "./themes/default/Archive";
import { Home } from "./themes/default/Home";
import { Layout } from "./themes/default/Layout";
import { NotFound } from "./themes/default/NotFound";
import { Page } from "./themes/default/Page";
import { Single } from "./themes/default/Single";
import type { PageContext } from "./types";

export function ThemeApp({ ctx }: { ctx: PageContext }) {
  let body;
  switch (ctx.view) {
    case "home":
      body = <Home site={ctx.site} posts={ctx.posts ?? []} />;
      break;
    case "single":
      body = ctx.post ? <Single post={ctx.post} /> : <NotFound />;
      break;
    case "page":
      body = ctx.post ? <Page post={ctx.post} /> : <NotFound />;
      break;
    case "archive":
      body = ctx.archive ? <Archive archive={ctx.archive} posts={ctx.posts ?? []} /> : <NotFound />;
      break;
    default:
      body = <NotFound />;
  }
  return (
    <Layout site={ctx.site} menu={ctx.menu}>
      {body}
    </Layout>
  );
}
