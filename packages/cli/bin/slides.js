#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
const args = process.argv.slice(3);
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const showHelp = () => {
  console.log(`Usage: slides <command> [options]

Commands:
  iiif    Create static IIIF derivatives
`);
};

if (!command || command === "--help" || command === "-h") {
  showHelp();
  process.exit(0);
}

if (command !== "iiif") {
  console.error(`Unknown command: ${command}`);
  showHelp();
  process.exit(1);
}

const child = spawn(
  process.execPath,
  [resolve(packageRoot, "src/commands/build-iiif.ts"), ...args],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
