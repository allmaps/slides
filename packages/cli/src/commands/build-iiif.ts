import {
  buildStaticIiif,
  parseIiifOptions,
  type BuildIiifOptions,
} from "@allmaps/sveltekit-iiif";

import { loadSlidesConfig } from "../config.ts";

export type BuildIiifCommandOptions = BuildIiifOptions & {
  contentPackageName?: string;
  configPath?: string;
};

export async function runBuildIiifCommand(
  commandOptions: BuildIiifCommandOptions = {},
) {
  const { configPath, contentPackageName } = commandOptions;
  const config = await loadSlidesConfig({ contentPackageName, configPath });

  if (!config.iiif.enabled) {
    console.log("IIIF generation is disabled in the Slides config.");
    return;
  }

  const options = parseIiifOptions(
    config.publicUrl,
    {
      sizes: config.iiif.sizes,
      tiles: config.iiif.tiles,
      tileSize: config.iiif.tileSize,
      webp: config.iiif.webp,
      ...commandOptions,
    },
    config.iiif,
  );

  await buildStaticIiif(options);
}
