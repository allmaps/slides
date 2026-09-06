import { env } from "$env/dynamic/public";
import { parse } from "yaml";

import { slidesConfigFiles } from "$lib/shared/content-package";
import { parseSlidesConfig } from "$lib/shared/content-schema";
import type { SlidesConfig } from "$lib/shared/types";

const publicEnv = env as Record<string, string | undefined>;

const expandEnvValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
      return publicEnv[name] ?? "";
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => expandEnvValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, expandEnvValue(entry)]),
    );
  }

  return value;
};

const parseRawConfig = (path: string, raw: string) => {
  if (path.endsWith(".json")) {
    return expandEnvValue(JSON.parse(raw));
  }

  return expandEnvValue(parse(raw) ?? {});
};

const readSlidesConfig = (): SlidesConfig => {
  const [entry] = Object.entries(slidesConfigFiles ?? {}).toSorted(([a], [b]) =>
    a.localeCompare(b),
  );

  if (!entry) return {};

  const [path, raw] = entry;
  let rawConfig: unknown;

  try {
    rawConfig = parseRawConfig(path, raw);
  } catch (error) {
    console.warn(
      `Ignoring app-level Slides config values because slides.config could not be read:\n${path}\n  - ${error instanceof Error ? error.message : String(error)}`,
    );
    return {};
  }

  const result = parseSlidesConfig(rawConfig, path);

  return result.success ? result.data : {};
};

export const slidesConfig = readSlidesConfig();
