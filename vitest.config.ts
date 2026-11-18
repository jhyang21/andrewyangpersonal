import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pica's tests (src/pica, src/app/projects/pica). Run from the repo root: some read files by path.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
