import path from "node:path";
import { fileURLToPath } from "node:url";
import { booleanOption, type RuntimeSlidesConfig } from "../content/config.ts";
import { loadContent } from "../content/index.ts";
import type { Thumbnail, ThumbnailManifest } from "../model/thumbnails.ts";
import type { RenderResult } from "@allmaps/static-render/types";
import { atomicWrite, readJson } from "./files.ts";
import { runNode } from "./process.ts";

export function thumbnailPaths(config: RuntimeSlidesConfig) {
  const cacheRoot = path.resolve(process.env.SLIDES_THUMBNAILS_CACHE_ROOT ?? path.join(config.cacheDir, "slides", "thumbnails"));
  return { cacheRoot,
    annotationsRoot: path.resolve(process.env.SLIDES_ANNOTATIONS_CACHE_ROOT ?? path.join(config.cacheDir, "slides", "annotations")),
    work: path.join(config.projectDir, "thumbnails"), outputRoot: path.join(cacheRoot, "assets"),
    manifestPath: path.join(config.projectDir, "thumbnails", "manifest.json") };
}
export async function buildThumbnails(config: RuntimeSlidesConfig) {
  const { prepareThumbnails } = await import("./prepare.ts");
  const content = await loadContent(config);
  const paths = thumbnailPaths(config);
  const offline = booleanOption(process.env.SLIDES_THUMBNAILS_OFFLINE);
  const prepared = await prepareThumbnails(content, { ...paths, assetRoot: config.sourceContentDir,
    offline, refresh: booleanOption(process.env.SLIDES_THUMBNAILS_REFRESH), publicUrl: config.publicUrl });
  const planPath = path.join(paths.work, "plan.json"), resultPath = path.join(paths.work, "result.json");
  await atomicWrite(planPath, JSON.stringify(prepared.plan));
  await atomicWrite(path.join(paths.work, "manifest-template.json"), JSON.stringify(prepared.manifest));
  await runNode(fileURLToPath(import.meta.resolve("@allmaps/static-render/cli")), [planPath,
    "--assets", config.sourceContentDir, "--output", paths.outputRoot, "--cache", paths.cacheRoot,
    "--result", resultPath, ...(offline ? ["--offline"] : [])]);
  const result = await readJson<RenderResult>(resultPath);
  if (!result) throw new Error("Renderer did not produce a result manifest");
  const image = (ref: Thumbnail) => {
    const output = result.images[ref.path];
    if (!output) throw new Error(`Missing rendered image: ${ref.path}`);
    return { ...output, path: `thumbnails/${output.path}` };
  };
  const manifest: ThumbnailManifest = prepared.manifest;
  for (const [key, value] of Object.entries(manifest.slides)) manifest.slides[key] = { light: image(value.light), dark: image(value.dark) };
  for (const key of Object.keys(manifest.layers)) manifest.layers[key] = image(manifest.layers[key]);
  for (const key of Object.keys(manifest.social)) manifest.social[key] = image(manifest.social[key]);
  for (const key of Object.keys(manifest.annotations)) manifest.annotations[key] = `thumbnails/${result.resources[key]}`;
  await atomicWrite(paths.manifestPath, JSON.stringify(manifest));
  return manifest;
}
