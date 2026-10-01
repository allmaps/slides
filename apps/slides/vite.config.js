import { slidesContent, iiifImageAssets } from "@allmaps/slides/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
// Vite loads this through the cached runner module for both SSR and client
// builds. Each invocation must create independent plugin instances.
export default defineConfig(() => {
  const iiifEnabled = !FALSE_VALUES.has(
    process.env.SLIDES_IIIF_ENABLED?.trim().toLowerCase() ?? "",
  );
  return {
    build: {
      emptyOutDir: true,
      license: { fileName: "_app/licenses/dependencies.md" },
    },
    plugins: [
      slidesContent(),
      tailwindcss(),
      ...(iiifEnabled ? [iiifImageAssets({ input: process.env.SLIDES_IIIF_INPUT_ROOT, publicUrl: process.env.PUBLIC_URL, webp: process.env.SLIDES_IIIF_WEBP !== "false", sizes: process.env.SLIDES_IIIF_SIZES !== "false", tiles: process.env.SLIDES_IIIF_TILES !== "false", tileSize: process.env.SLIDES_IIIF_TILE_SIZE })] : []),
      sveltekit(),
    ],
    resolve: { dedupe: ["svelte"] },
    ssr: {
      // Vite matches noExternal by package name, including for subpath imports.
      noExternal: ["@lucide/svelte", "@allmaps/slides", "@allmaps/svelte-canvas-panel"],
      external: ["@allmaps/slides/server/iiif", "@allmaps/slides/build/catalog"],
    },
  };
});
