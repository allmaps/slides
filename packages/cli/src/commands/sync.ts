#!/usr/bin/env node

import { loadSlidesConfig } from "../config.ts";
import { formatContentResult, validateContent } from "../content.ts";

type SyncCommandOptions = {
  contentPackageName?: string;
  configPath?: string;
};

export const runSyncCommand = async ({
  contentPackageName,
  configPath,
}: SyncCommandOptions = {}) => {
  const config = await loadSlidesConfig({ contentPackageName, configPath });
  const result = await validateContent(config);

  console.log(formatContentResult(config, result));
};
