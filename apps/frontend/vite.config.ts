import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  // Bundle all deps into the SSR output so apps/server can import it standalone.
  ssr: { noExternal: true },
  build: { manifest: true },
});
