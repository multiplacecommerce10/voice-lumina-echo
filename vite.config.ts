// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

export default defineConfig({
  vite: {
    plugins: [mcpPlugin()],

    optimizeDeps: {
      // Pre-bundle these on startup. Without it, the dev server discovers them
      // on the first page load, re-optimizes and reloads mid-request, which the
      // preview proxy surfaces as a transient 500 "HTTPError".
      include: [
        "@tanstack/router-core",
        "@tanstack/router-core/ssr/client",
        "@tanstack/react-router",
        "@tanstack/react-query",
        "react",
        "react-dom",
        "react-dom/client",
      ],
    },
  },
});
