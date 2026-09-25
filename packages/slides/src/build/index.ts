import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { loadSlidesConfig, getAppEnvironment, booleanOption, type LoadSlidesConfigOptions } from "../content/config.ts";
import { loadContent } from "../content/index.ts";
import { buildThumbnails, thumbnailPaths } from "./thumbnails.ts";
import { prepareRunner } from "./runner.ts";
import { prepareIiif } from "./iiif.ts";
import { runNode } from "./process.ts";
export { buildThumbnails } from "./thumbnails.ts";
export { loadSlidesConfig } from "../content/config.ts";

export async function runSite(command: "dev" | "build" | "preview" | "check" | "thumbnails", options: LoadSlidesConfigOptions = {}, args: string[] = []) {
  const config = await loadSlidesConfig({ ...options, mode: command === "dev" ? "development" : "production" });
  const content = await loadContent(config);
  console.log(`Loaded ${content.slideCount} slides in ${content.slideshowCount} slideshows from ${config.sourceContentDir}.`);
  if (command === "thumbnails") return buildThumbnails(config);
  if (command === "dev" && config.iiif.enabled && content.images.length) {
    console.log(`IIIF uses the last completed batch. Refresh with: slides iiif ${JSON.stringify(config.sourceContentDir)}`);
  }
  const env = getAppEnvironment(config);
  const thumbnails = thumbnailPaths(config);
  Object.assign(env, { SLIDES_THUMBNAILS_MANIFEST: thumbnails.manifestPath, SLIDES_THUMBNAILS_ASSETS: thumbnails.outputRoot });
  if (command === "build" && booleanOption(env.SLIDES_THUMBNAILS_ENABLED, true)) await buildThumbnails(config);
  if (command === "build") await prepareIiif(config);
  const require = createRequire(import.meta.url);
  if (command === "check") {
    // svelte-check deliberately skips node_modules, including Vite's default
    // cache location. A temporary linked workspace keeps diagnostics effective.
    const runner = await realpath(await mkdtemp(path.join(tmpdir(), "slides-check-")));
    try {
      await prepareRunner(config, runner);
      await runNode(path.join(path.dirname(require.resolve("@sveltejs/kit/package.json")), "svelte-kit.js"), ["sync"], { cwd: runner, env });
      return await runNode(path.join(path.dirname(require.resolve("svelte-check/package.json")), "bin/svelte-check"), ["--tsconfig", "./tsconfig.json", ...args], { cwd: runner, env });
    } finally { await rm(runner, { recursive: true, force: true }); }
  }
  const runner = await prepareRunner(config);
  return runNode(path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js"), [command, ...args], { cwd: runner, env });
}
export const buildSite = (options: LoadSlidesConfigOptions = {}) => runSite("build", options);
