#!/usr/bin/env node
import path from "node:path";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { renderBatch } from "./index.ts";
import { atomicWrite } from "./cache.ts";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    assets: { type: "string" },
    output: { type: "string" },
    cache: { type: "string" },
    result: { type: "string" },
    offline: { type: "boolean" },
    help: { type: "boolean" },
  },
});
if (
  values.help ||
  positionals.length !== 1 ||
  !values.assets ||
  !values.output ||
  !values.cache
) {
  console.log(
    "Usage: allmaps-static-render plan.json --assets <directory> --output <directory> --cache <directory> [--result result.json] [--offline]",
  );
  process.exit(values.help ? 0 : 1);
}
try {
  const plan = JSON.parse(await readFile(positionals[0], "utf8"));
  const result = await renderBatch(plan, {
    assetRoot: path.resolve(values.assets),
    outputRoot: path.resolve(values.output),
    cacheRoot: path.resolve(values.cache),
    offline: values.offline,
  });
  await atomicWrite(
    values.result ?? path.join(values.output, "result.json"),
    JSON.stringify(result),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
