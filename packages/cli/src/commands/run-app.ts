#!/usr/bin/env node

import { spawn } from "node:child_process";

import { getAppEnvironment, loadSlidesConfig } from "../config.ts";
import {
  formatContentResult,
  validateContent,
  watchContent,
} from "../content.ts";

type AppCommand = "dev" | "build" | "preview" | "check";

type RunAppCommandOptions = {
  args?: string[];
  configPath?: string;
};

const APP_COMMANDS = new Set(["dev", "build", "preview", "check"]);

export const runAppCommand = async (
  appCommand: string,
  { args = [], configPath }: RunAppCommandOptions = {},
) => {
  if (!APP_COMMANDS.has(appCommand)) {
    throw new Error(`Unknown app command: ${appCommand}`);
  }

  const config = await loadSlidesConfig(configPath);
  const initialContent = await validateContent(config);

  console.log(formatContentResult(config, initialContent));

  const watcher =
    appCommand === "dev"
      ? watchContent(config, (result) => {
          console.log(formatContentResult(config, result));
        })
      : undefined;

  const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const child = spawn(
    packageManager,
    ["--dir", config.appDir, appCommand as AppCommand, ...args],
    {
      env: getAppEnvironment(config),
      stdio: "inherit",
    },
  );

  const stop = (signal: NodeJS.Signals) => {
    watcher?.close();

    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));

  return new Promise<void>((resolve) => {
    child.on("exit", (code, signal) => {
      watcher?.close();

      if (signal) {
        process.kill(process.pid, signal);
        return;
      }

      if (code && code !== 0) {
        process.exit(code);
        return;
      }

      resolve();
    });
  });
};
