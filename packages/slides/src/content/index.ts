import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseFrontmatter } from "../model/config.ts";
import { slideMetadataSchema } from "../model/content-schema.ts";
import { buildProject } from "../model/project.ts";
import { createContentAssets } from "./assets.ts";
import { exists, type RuntimeSlidesConfig } from "./config.ts";

const ignored = new Set(["node_modules", ".git", ".svelte-kit", "dist", "build"]);
export const slash = (filename: string) => filename.split(path.sep).join("/");
export async function walk(directory: string): Promise<string[]> {
  if (!await exists(directory)) return [];
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignored.has(entry.name) || entry.name.startsWith(".")) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename));
    else if (entry.isFile()) files.push(filename);
  }
  return files;
}
export function within(root: string, filename: string) {
  const relative = path.relative(root, filename);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative))
    throw new Error(`Content path is outside its root: ${filename}`);
  return slash(relative);
}
export async function loadContent(config: RuntimeSlidesConfig) {
  const slides: Record<string, { metadata: unknown; filename: string }> = {};
  for (const show of config.slidesConfig.slideshows) {
    const directory = path.resolve(config.sourceContentDir, show.path);
    within(config.sourceContentDir, directory);
    if (!await exists(directory) || !(await stat(directory)).isDirectory()) throw new Error(`Slideshow directory not found: ${directory}`);
    within(config.sourceContentDir, await realpath(directory));
    for (const filename of await walk(directory)) {
      if (!/\.md$/i.test(filename)) continue;
      try {
        const metadata = parseFrontmatter(await readFile(filename, "utf8"));
        const parsed = slideMetadataSchema.safeParse(metadata);
        if (!parsed.success) throw new Error(parsed.error.message);
        slides[within(config.sourceContentDir, filename)] = { filename, metadata };
      } catch (error) { throw new Error(`Invalid slide ${filename}: ${String(error)}`); }
    }
  }
  const assets = await walk(path.join(config.sourceContentDir, "assets"));
  const imageFiles = config.iiif.enabled ? await walk(config.iiif.inputRoot) : assets;
  const images = imageFiles.filter(f => /\.(avif|gif|jpeg|jpg|png|tif|tiff|webp)$/i.test(f));
  for (const filename of images) within(config.sourceContentDir, filename);
  const data = assets.filter(f => /\.(geojson|json)$/i.test(f));
  const styles: Record<string, unknown> = {};
  for (const filename of data.filter(f => /^assets\/(map-styles|styles)\/.*\.json$/i.test(within(config.sourceContentDir, f))))
    styles[`./${within(config.sourceContentDir, filename)}`] = JSON.parse(await readFile(filename, "utf8"));
  const { resolveAsset } = createContentAssets({ config, images, data });
  const project = buildProject(config.slidesConfig, slides, resolveAsset);
  return { config, slides, images, data, styles, project,
    slideCount: Object.keys(slides).length, slideshowCount: config.slidesConfig.slideshows.length };
}
export type ContentSnapshot = Awaited<ReturnType<typeof loadContent>>;
