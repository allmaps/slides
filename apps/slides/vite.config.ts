import path from "node:path";

import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const contentPackageEntry = process.env.SLIDES_CONTENT_PACKAGE_ENTRY;

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: {
    alias: contentPackageEntry
      ? {
          "@allmaps/slides-content": path.normalize(contentPackageEntry),
        }
      : {},
  },
});
