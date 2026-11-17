import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Themes live user-side in content/themes (outside apps/), loaded via the @themes alias.
const themesDir = fileURLToPath(new URL("../../content/themes", import.meta.url));
// Stable theme-facing API (PageContext, PostView, …) that content/themes import from.
const themeApi = fileURLToPath(new URL("./src/types.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@themes": themesDir, "@theme-api": themeApi } },
  // Bundle all deps into the SSR output so apps/server can import it standalone.
  ssr: { noExternal: true },
  build: { manifest: true },
});
