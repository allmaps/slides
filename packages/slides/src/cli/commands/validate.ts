#!/usr/bin/env node

import { loadSlidesConfig } from "../../content/config.ts";
import { formatContentResult, validateContent } from "../content.ts";

type ValidateCommandOptions = {
  contentPackageName?: string;
  configPath?: string;
};

export const runValidateCommand = async ({
  contentPackageName,
  configPath,
}: ValidateCommandOptions = {}) => {
  const config = await loadSlidesConfig({ contentPackageName, configPath });
  const result = await validateContent(config);

  console.log(formatContentResult(config, result));
};
