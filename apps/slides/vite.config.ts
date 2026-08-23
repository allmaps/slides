import path from "node:path";

import {
  iiifImageAssets,
  iiifServerCatalog,
} from "@allmaps/sveltekit-iiif/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const contentPackageEntry = process.env.SLIDES_CONTENT_PACKAGE_ENTRY;
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const iiifEnabled = !FALSE_VALUES.has(
  process.env.SLIDES_IIIF_ENABLED?.trim().toLowerCase() ?? "",
);

export default defineConfig({
  plugins: [
    tailwindcss(),
    ...(iiifEnabled ? [iiifImageAssets()] : []),
    iiifServerCatalog({ enabled: iiifEnabled }),
    sveltekit(),
  ],
  ssr: {
    external: ["sharp"],
  },
  resolve: {
    alias: contentPackageEntry
      ? {
          "@allmaps/slides-content": path.normalize(contentPackageEntry),
        }
      : {},
  },
});
