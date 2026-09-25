#!/usr/bin/env node

import { Command, Option } from "commander";

import { CommandInterruptedError } from "../build/process.ts";
import { runBuildIiifCommand } from "./commands/build-iiif.ts";
import { runAppCommand } from "./commands/run-app.ts";
import { runValidateCommand } from "./commands/validate.ts";

const program = new Command();

const addConfigOption = (command) =>
  command.option("-c, --config <path>", "Slides config file");

const addAppCommand = (name, description) => {
  const command = program
    .command(name)
    .description(description)
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .argument("[content]", "Content directory or package")
    .argument("[args...]", "Arguments passed to the SvelteKit command");

  command.option("--outDir <path>", "Static site output directory").option("--cacheDir <path>", "Vite cache directory");
  addConfigOption(command).action((contentPackage, args, options) =>
    runAppCommand(name, {
      args,
      contentPackageName: contentPackage,
      configPath: options.config,
      outDir: options.outDir,
      cacheDir: options.cacheDir,
    }),
  );
};

program
  .name("slides")
  .description("Prepare and build Allmaps Slides content")
  .showHelpAfterError()
  .showSuggestionAfterError();

addAppCommand("thumbnails", "Generate map thumbnails without building the app");
addAppCommand("dev", "Validate content and start the Slides dev server");
addAppCommand("build", "Validate content and build the static app");
addAppCommand("preview", "Preview the built app");
addAppCommand("check", "Validate content and run Svelte checks");

addConfigOption(
  program
    .command("validate")
    .description("Validate the selected content directory")
    .argument("[content]", "Content directory or package"),
).action((contentPackage, options) =>
  runValidateCommand({
    contentPackageName: contentPackage,
    configPath: options.config,
  }),
);

addConfigOption(
  program
    .command("iiif")
    .description("Create static IIIF derivatives")
    .argument("[content]", "Content directory or package")
    .option("-f, --force", "Recreate existing image derivatives")
    .option("--id <uri>", "Public IIIF base URI")
    .option("--collection-label <label>", "IIIF collection label")
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
    collectionLabel: options.collectionLabel,
    input: options.input,
    output: options.output,
    sizes: options.sizes,
    tiles: options.tiles,
    tileSize: options.tileSize,
    webp: options.webp,
  }),
);

program.parseAsync().catch((error) => {
  if (error instanceof CommandInterruptedError) {
    process.exitCode = error.exitCode;
    return;
  }
  console.error(error);
  process.exit(1);
});
