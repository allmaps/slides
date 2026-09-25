import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import type { BuildIiifOptions } from "@allmaps/iiif";
import { loadSlidesConfig } from "../../content/config.ts";
import { prepareIiif } from "../../build/iiif.ts";

export type BuildIiifCommandOptions = BuildIiifOptions & {
  contentPackageName?: string;
  configPath?: string;
  cacheDir?: string;
};

export async function runBuildIiifCommand(
  commandOptions: BuildIiifCommandOptions = {},
) {
  const { configPath, contentPackageName, cacheDir } = commandOptions;
  const config = await loadSlidesConfig({ contentPackageName, configPath, cacheDir });

  if (!config.iiif.enabled) {
    console.log("IIIF generation is disabled in the Slides config.");
    return;
  }

  const result = await prepareIiif(config, commandOptions);
  // A normal batch stays in the cache. Preserve explicit standalone exports.
  const output = commandOptions.output ? path.resolve(commandOptions.output)
    : config.raw.iiif?.output ? config.iiif.outputRoot : undefined;
  if (output) {
    for (const [request, asset] of Object.entries(result.assets)) {
      const filename = path.join(output, request);
      await mkdir(path.dirname(filename), { recursive: true });
      await copyFile(asset.filename, filename);
    }
    console.log(`Exported IIIF to ${output}.`);
  }
  console.log("IIIF batch complete. Running dev servers will refresh automatically.");
  return result;
}
