import path from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { buildStaticIiif, parseIiifOptions } from "@allmaps/iiif";
import { writeIiifCatalog } from "@allmaps/iiif/catalog";
import { type RuntimeSlidesConfig } from "../content/config.ts";
import { loadContent, within } from "../content/index.ts";

export const iiifCatalogPath = (config: RuntimeSlidesConfig) => path.join(config.workDir, "iiif-catalog.json");
export async function prepareIiif(config: RuntimeSlidesConfig, publicUrl = config.publicUrl) {
  const catalog = iiifCatalogPath(config);
  if (!config.iiif.enabled) { await writeIiifCatalog(catalog, { assets: {} }); return catalog; }
  const content = await loadContent(config);
  const identity = createHash("sha256").update(JSON.stringify([publicUrl, config.iiif]));
  for (const filename of content.images) identity.update(filename).update(await readFile(filename));
  const publication = path.join(config.workDir, "iiif", identity.digest("hex"));
  const options = parseIiifOptions(publicUrl, {
    input: config.iiif.inputRoot, output: publication,
    id: config.iiif.idBase, collectionLabel: config.iiif.collectionLabel,
    sizes: config.iiif.sizes, tiles: config.iiif.tiles, tileSize: config.iiif.tileSize, webp: config.iiif.webp,
  }, config.iiif);
  const result = await buildStaticIiif(options, { failOnEmpty: false,
    images: content.images.map(absolutePath => ({ absolutePath, relativePath: within(config.iiif.inputRoot, absolutePath) })),
    cacheRoot: path.join(config.cacheDir, "slides", "iiif"),
  });
  await writeIiifCatalog(catalog, result);
  return catalog;
}
