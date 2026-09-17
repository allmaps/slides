import { env } from "$env/dynamic/public";
import { parseConfigDocument } from "@allmaps/slides-model/config";

import { slidesConfigFiles } from "$lib/shared/content-package";
import { parseSlidesConfig } from "$lib/shared/content-schema";
import type { SlidesConfig } from "$lib/shared/types";

const publicEnv = env as Record<string, string | undefined>;
const defaultSlidesConfig: SlidesConfig = {
  title: "Slides",
  main: "main",
  slideshows: [],
  sources: {},
};

const readSlidesConfig = (): SlidesConfig => {
  const [entry] = Object.entries(slidesConfigFiles ?? {}).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );

  if (!entry) return defaultSlidesConfig;

  const [path, raw] = entry;
  let rawConfig: unknown;

  try {
    rawConfig = parseConfigDocument(raw, path, publicEnv);
  } catch (error) {
    console.warn(
      `Ignoring Slides config because it could not be read:\n${path}\n  - ${error instanceof Error ? error.message : String(error)}`,
    );
    return defaultSlidesConfig;
  }

  const result = parseSlidesConfig(rawConfig, path);

  return result.success ? result.data : defaultSlidesConfig;
};

export const slidesConfig = readSlidesConfig();
