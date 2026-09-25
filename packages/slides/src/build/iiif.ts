import path from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildStaticIiif, parseIiifOptions, type BuildIiifOptions } from "@allmaps/iiif";
import { writeIiifCatalog } from "@allmaps/iiif/catalog";
import { type RuntimeSlidesConfig } from "../content/config.ts";
import { loadContent, within } from "../content/index.ts";

// Development and production consume the same last successful batch.
export const iiifCatalogPath = (config: RuntimeSlidesConfig) => path.join(config.projectDir, "iiif", "catalog.json");
export async function prepareIiif(config: RuntimeSlidesConfig, overrides: BuildIiifOptions = {}) {
  const catalog = iiifCatalogPath(config);
  const options = parseIiifOptions(config.publicUrl, {
    sizes: config.iiif.sizes, tiles: config.iiif.tiles, tileSize: config.iiif.tileSize, webp: config.iiif.webp,
    ...Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined)),
    output: path.join(config.projectDir, "iiif", "publications"),
  }, config.iiif);
  if (!config.iiif.enabled) {
    const result = { assets: {}, files: [], images: [], options };
    await writeIiifCatalog(catalog, result);
    return result;
  }
  const content = await loadContent({ ...config, iiif: { ...config.iiif, inputRoot: options.inputRoot } });
  const identity = createHash("sha256").update(JSON.stringify({ ...options, force: undefined }));
  for (const filename of content.images) identity.update(filename).update(await readFile(filename));
  options.outputRoot = path.join(options.outputRoot, identity.digest("hex"));
  const result = await buildStaticIiif(options, { failOnEmpty: false,
    images: content.images.map(absolutePath => ({ absolutePath, relativePath: within(options.inputRoot, absolutePath) })),
    cacheRoot: path.join(config.cacheDir, "slides", "iiif"),
  });
  await writeIiifCatalog(catalog, result);
  return result;
}
