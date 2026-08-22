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
    .argument("[args...]", "Arguments passed to the SvelteKit command");

  addConfigOption(command).action((args, options) =>
    runAppCommand(name, {
      args,
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
    .description("Validate the configured Slides content package"),
).action((options) => runSyncCommand({ configPath: options.config }));

addConfigOption(
  program
    .command("iiif")
    .description("Create static IIIF derivatives")
    .option("-f, --force", "Recreate existing image derivatives")
    .option("--id <uri>", "Public IIIF base URI")
    .option("--input <path>", "Source image folder")
    .option("--output <path>", "IIIF output folder")
    .option("--tile-size <pixels>", "Tile size passed to sharp")
    .addOption(
      new Option("--webp", "Generate WebP derivatives alongside JPEG")
        .default(true),
    )
    .option("--no-webp", "Generate JPEG derivatives only"),
).action((options) =>
  runBuildIiifCommand({
    configPath: options.config,
    force: options.force,
    id: options.id,
    input: options.input,
    output: options.output,
    tileSize: options.tileSize,
    webp: options.webp,
  }),
);

program.parseAsync().catch((error) => {
  console.error(error);
  process.exit(1);
});
