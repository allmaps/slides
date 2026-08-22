#!/usr/bin/env node

import { loadSlidesConfig } from "../config.ts";
import { formatContentResult, validateContent } from "../content.ts";

type SyncCommandOptions = {
  configPath?: string;
};

export const runSyncCommand = async ({
  configPath,
}: SyncCommandOptions = {}) => {
  const config = await loadSlidesConfig(configPath);
  const result = await validateContent(config);

  console.log(formatContentResult(config, result));
};
