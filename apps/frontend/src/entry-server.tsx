import { renderToString } from "react-dom/server";
import { ThemeApp } from "./theme-app";
import type { PageContext } from "./types";

export function render(ctx: PageContext): { html: string } {
  return { html: renderToString(<ThemeApp ctx={ctx} />) };
}

export type { PageContext } from "./types";
