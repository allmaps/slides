import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

type RawSlidesConfig = {
  app?: {
    directory?: string;
  };
  content?: {
    directory?: string;
  };
  site?: {
    basePath?: string;
    publicUrl?: string;
  };
  routing?: {
    singleProjectRoot?: boolean | string | number;
  };
  protomaps?: {
    key?: string;
  };
  interface?: Record<string, unknown>;
  iiif?: {
    input?: string;
    output?: string;
    id?: string;
  };
};

export type SlidesConfig = {
  configPath: string | undefined;
  rootDir: string;
  workspaceRoot: string;
  appDir: string;
  sourceContentDir: string;
  publicBasePath: string;
  publicUrl: string;
  protomapsKey: string;
  singleProjectRoot: boolean;
  iiif: {
    inputRoot: string;
    outputRoot: string;
    idBase: string | undefined;
  };
  raw: RawSlidesConfig;
};

const CONFIG_FILENAMES = [
  "slides.config.yml",
  "slides.config.yaml",
  "slides.config.json",
];
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "..", "..");

const fileExists = async (filePath: string) => {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

const resolveFrom = (root: string, value: string) =>
  path.isAbsolute(value) ? value : path.resolve(root, value);

const getString = (value: unknown, fallback = "") =>
  value === undefined || value === null ? fallback : String(value);

const getOptionalString = (value: unknown) =>
  value === undefined || value === null ? undefined : String(value);

const getBoolean = (value: unknown, fallback = false) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  const normalized = String(value).trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return fallback;
};

const expandEnvValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
      return process.env[name] ?? "";
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

const parseConfigFile = async (configPath: string): Promise<RawSlidesConfig> => {
  const contents = await readFile(configPath, "utf8");

  if (configPath.endsWith(".json")) {
    return expandEnvValue(JSON.parse(contents)) as RawSlidesConfig;
  }

  return (expandEnvValue(parse(contents) ?? {}) ?? {}) as RawSlidesConfig;
};

const findDefaultConfig = async (cwd: string) => {
  let currentDir = cwd;

  while (true) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = path.join(currentDir, filename);
      if (await fileExists(candidate)) return candidate;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    currentDir = parentDir;
  }
};

export const loadSlidesConfig = async (
  configPath: string | undefined,
  cwd = process.cwd(),
): Promise<SlidesConfig> => {
  const resolvedConfigPath = configPath
    ? resolveFrom(cwd, configPath)
    : await findDefaultConfig(cwd);
  const rootDir = resolvedConfigPath ? path.dirname(resolvedConfigPath) : cwd;
  const raw = resolvedConfigPath ? await parseConfigFile(resolvedConfigPath) : {};
  const appDir = resolveFrom(
    rootDir,
    getString(raw.app?.directory, path.join(workspaceRoot, "apps", "slides")),
  );
  const sourceContentDir = resolveFrom(
    rootDir,
    getString(raw.content?.directory, "content"),
  );
  const publicBasePath = getString(
    raw.site?.basePath,
    process.env.PUBLIC_BASE_PATH ?? "",
  );
  const publicUrl = getString(
    raw.site?.publicUrl,
    process.env.PUBLIC_URL ?? publicBasePath,
  );
  const protomapsKey = getString(
    raw.protomaps?.key,
    process.env.PUBLIC_PROTOMAPS_KEY ?? "",
  );

  return {
    configPath: resolvedConfigPath,
    rootDir,
    workspaceRoot,
    appDir,
    sourceContentDir,
    publicBasePath,
    publicUrl,
    protomapsKey,
    singleProjectRoot: getBoolean(raw.routing?.singleProjectRoot),
    iiif: {
      inputRoot: resolveFrom(
        appDir,
        getString(raw.iiif?.input, path.join("static", "images")),
      ),
      outputRoot: resolveFrom(
        appDir,
        getString(raw.iiif?.output, path.join("static", "iiif")),
      ),
      idBase: getOptionalString(raw.iiif?.id),
    },
    raw,
  };
};

export const getAppEnvironment = (config: SlidesConfig) => ({
  ...process.env,
  PUBLIC_BASE_PATH: config.publicBasePath,
  PUBLIC_URL: config.publicUrl,
  PUBLIC_PROTOMAPS_KEY: config.protomapsKey,
  PUBLIC_SLIDES_SINGLE_PROJECT_ROOT: config.singleProjectRoot ? "true" : "false",
  SLIDES_CONFIG_PATH: config.configPath ?? "",
});
