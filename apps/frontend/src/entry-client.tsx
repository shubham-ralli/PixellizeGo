import { hydrateRoot } from "react-dom/client";
import { Root } from "./root";
import type { PageContext } from "./types";

declare global {
  interface Window {
    __PAGE__?: PageContext;
  }
}

const ctx = window.__PAGE__;
const el = document.getElementById("app");
if (ctx && el) {
  hydrateRoot(el, <Root initial={ctx} />);
}
