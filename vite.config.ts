import { copyFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/** Project site: https://matiyasmetek18-sketch.github.io/project_grace/ */
const base = "/project_grace/";

/** GitHub Pages has no rewrite rules. A copy of the app at 404.html is what deep links receive. */
function githubPagesSpaFallback() {
  return {
    name: "github-pages-spa-fallback",
    apply: "build" as const,
    closeBundle() {
      const dist = resolve("dist");
      copyFileSync(resolve(dist, "index.html"), resolve(dist, "404.html"));
      writeFileSync(resolve(dist, ".nojekyll"), "");
    },
  };
}

export default defineConfig({
  base,
  plugins: [react(), githubPagesSpaFallback()],
  server: { port: 5173 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
});
