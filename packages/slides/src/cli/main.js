#!/usr/bin/env node

import { Command } from "commander";
import { getBuildInfo } from "../build-info.ts";

import { CommandInterruptedError } from "../build/process.ts";
import { runBuildIiifCommand } from "./commands/build-iiif.ts";
import { runAppCommand } from "./commands/run-app.ts";
import { runValidateCommand } from "./commands/validate.ts";
import { runCachePurgeCommand } from "./commands/cache.ts";
import { runInitCommand } from "./commands/init.ts";

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
  .version((await getBuildInfo()).version)
  .description("Prepare and build Allmaps Slides content")
  .showHelpAfterError()
  .showSuggestionAfterError();

program.command("init")
  .alias("create")
  .description("Create a minimal Slides project without overwriting existing files")
  .argument("[directory]", "New project directory", ".")
  .option("--title <title>", "Project title (prompted when omitted)")
  .option("--protomaps-key <key>", "Optional Protomaps API key (prompted when omitted)")
  .option("-y, --yes", "Skip prompts and use defaults for omitted values")
  .action((directory, options) => runInitCommand(directory, options));

addAppCommand("thumbnails", "Generate map thumbnails without building the app");
addAppCommand("dev", "Validate content and start the Slides dev server");
addAppCommand("build", "Validate content and build the static app");
addAppCommand("preview", "Preview the built app");
addAppCommand("check", "Validate content and run Svelte checks");

addConfigOption(program.command("cache").description("Manage generated caches")
  .command("purge").description("Remove project caches; stop its dev server first")
  .argument("[content]", "Content directory or package")
  .option("--cacheDir <path>", "Vite cache directory (same as dev/build)")
  .option("--all", "Also remove shared derivatives/downloads and other project caches")
  .option("--dry-run", "List directories without removing them"))
  .action((contentPackage, options) => runCachePurgeCommand({
    contentPackageName: contentPackage, configPath: options.config,
    cacheDir: options.cacheDir, all: options.all, dryRun: options.dryRun,
  }));

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
    .description("Prepare an IIIF image batch for development and builds")
    .argument("[content]", "Content directory or package")
    .option("-f, --force", "Recreate existing image derivatives")
    .option("--no-force", "Reuse unchanged derivatives, overriding iiif.force")
    .option("--id <uri>", "Public IIIF base URI")
    .option("--collection-label <label>", "IIIF collection label")
    .option("--input <path>", "Source image folder")
    .option("--output <path>", "IIIF output folder")
    .option("--cacheDir <path>", "Vite cache directory (same as dev/build)")
    .option("--sizes", "Generate fixed-size full-image derivatives")
    .option("--no-sizes", "Skip fixed-size full-image derivatives")
    .option("--tiles", "Generate tile pyramid derivatives")
    .option("--no-tiles", "Skip tile pyramid derivatives")
    .option("--tile-size <pixels>", "Tile size passed to sharp")
    .option("--webp", "Generate WebP derivatives alongside JPEG")
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
    cacheDir: options.cacheDir,
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
