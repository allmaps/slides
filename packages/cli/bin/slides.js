#!/usr/bin/env node

import { Command, Option } from "commander";

import { runBuildIiifCommand } from "../src/commands/build-iiif.ts";
import { runAppCommand } from "../src/commands/run-app.ts";
import { runSyncCommand } from "../src/commands/sync.ts";

const program = new Command();

const addConfigOption = (command) =>
  command.option("-c, --config <path>", "Slides config file");

const addAppCommand = (name, description) => {
  const command = program
    .command(name)
    .description(description)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[content-package]", "Slides content package")
    .argument("[args...]", "Arguments passed to the SvelteKit command");

  addConfigOption(command).action((contentPackage, args, options) =>
    runAppCommand(name, {
      args,
      contentPackageName: contentPackage,
      configPath: options.config,
    }),
  );
};

program
  .name("slides")
  .description("Prepare and build Allmaps Slides projects")
  .showHelpAfterError()
  .showSuggestionAfterError();

addAppCommand("dev", "Validate content and start the Slides dev server");
addAppCommand("build", "Validate content and build the static app");
addAppCommand("preview", "Preview the built app");
addAppCommand("check", "Validate content and run Svelte checks");

addConfigOption(
  program
    .command("validate")
    .alias("sync")
    .description("Validate the Slides content package")
    .argument("[content-package]", "Slides content package"),
).action((contentPackage, options) =>
  runSyncCommand({
    contentPackageName: contentPackage,
    configPath: options.config,
  }),
);

addConfigOption(
  program
    .command("iiif")
    .description("Create static IIIF derivatives")
    .argument("[content-package]", "Slides content package")
    .option("-f, --force", "Recreate existing image derivatives")
    .option("--id <uri>", "Public IIIF base URI")
    .option("--input <path>", "Source image folder")
    .option("--output <path>", "IIIF output folder")
    .option("--sizes", "Generate fixed-size full-image derivatives")
    .option("--no-sizes", "Skip fixed-size full-image derivatives")
    .option("--tiles", "Generate tile pyramid derivatives")
    .option("--no-tiles", "Skip tile pyramid derivatives")
    .option("--tile-size <pixels>", "Tile size passed to sharp")
    .addOption(
      new Option("--webp", "Generate WebP derivatives alongside JPEG")
        .default(true),
    )
    .option("--no-webp", "Generate JPEG derivatives only"),
).action((contentPackage, options) =>
  runBuildIiifCommand({
    contentPackageName: contentPackage,
    configPath: options.config,
    force: options.force,
    id: options.id,
    input: options.input,
    output: options.output,
    sizes: options.sizes,
    tiles: options.tiles,
    tileSize: options.tileSize,
    webp: options.webp,
  }),
);

program.parseAsync().catch((error) => {
  console.error(error);
  process.exit(1);
});
