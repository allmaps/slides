import { access, readdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "yaml";

type RawSlidesConfig = {
  app?: {
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

type PackageJson = {
  name?: string;
};

type PnpmWorkspace = {
  packages?: string[];
};

type ContentPackage = {
  name: string;
  root: string;
  entry: string;
};

export type LoadSlidesConfigOptions = {
  configPath?: string;
  contentPackageName?: string;
  cwd?: string;
};

export type SlidesConfig = {
  configPath: string | undefined;
  rootDir: string;
  workspaceRoot: string;
  appDir: string;
  contentPackageEntry: string;
  contentPackageName: string;
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
const WORKSPACE_FILENAME = "pnpm-workspace.yaml";
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

const readPackageJson = async (packagePath: string) =>
  JSON.parse(await readFile(packagePath, "utf8")) as PackageJson;

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

const findPackageConfig = async (packageRoot: string) => {
  for (const filename of CONFIG_FILENAMES) {
    const candidate = path.join(packageRoot, filename);
    if (await fileExists(candidate)) return candidate;
  }

  return undefined;
};

const findNearestPackageRoot = async (startDir: string) => {
  let currentDir = startDir;

  while (true) {
    const packagePath = path.join(currentDir, "package.json");

    if (await fileExists(packagePath)) {
      const packageJson = await readPackageJson(packagePath);

      return {
        root: currentDir,
        name: packageJson.name,
      };
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    currentDir = parentDir;
  }
};

const findPackageRoot = async (entryPath: string, packageName: string) => {
  let currentDir = path.dirname(entryPath);

  while (true) {
    const packagePath = path.join(currentDir, "package.json");

    if (await fileExists(packagePath)) {
      const packageJson = await readPackageJson(packagePath);

      if (packageJson.name === packageName) {
        return currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(
        `Could not find package root for ${packageName} from ${entryPath}`,
      );
    }

    currentDir = parentDir;
  }
};

const resolvePackageEntryFrom = (root: string, packageName: string) => {
  const requireFromRoot = createRequire(path.join(root, "package.json"));

  return requireFromRoot.resolve(packageName);
};

const findWorkspaceRoot = async (cwd: string) => {
  let currentDir = cwd;

  while (true) {
    const workspacePath = path.join(currentDir, WORKSPACE_FILENAME);
    if (await fileExists(workspacePath)) return currentDir;

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) return undefined;
    currentDir = parentDir;
  }
};

const findWorkspacePackageRoot = async (
  packageName: string,
  cwd: string,
): Promise<string | undefined> => {
  const workspaceRoot = await findWorkspaceRoot(cwd);
  if (!workspaceRoot) return undefined;

  const workspacePath = path.join(workspaceRoot, WORKSPACE_FILENAME);
  const workspace = (parse(await readFile(workspacePath, "utf8")) ??
    {}) as PnpmWorkspace;

  for (const pattern of workspace.packages ?? []) {
    if (pattern.startsWith("!")) continue;

    const roots = pattern.endsWith("/*")
      ? await readdir(path.join(workspaceRoot, pattern.slice(0, -2)), {
          withFileTypes: true,
        })
          .then((entries) =>
            entries
              .filter((entry) => entry.isDirectory())
              .map((entry) =>
                path.join(workspaceRoot, pattern.slice(0, -2), entry.name),
              ),
          )
          .catch((error) => {
            if (
              error instanceof Error &&
              "code" in error &&
              error.code === "ENOENT"
            ) {
              return [];
            }

            throw error;
          })
      : [path.join(workspaceRoot, pattern)];

    for (const candidateRoot of roots) {
      const packagePath = path.join(candidateRoot, "package.json");
      if (!(await fileExists(packagePath))) continue;

      const packageJson = await readPackageJson(packagePath);
      if (packageJson.name === packageName) return candidateRoot;
    }
  }

  return undefined;
};

const resolveContentPackage = async (
  packageName: string,
  cwd: string,
): Promise<ContentPackage> => {
  const requireRoots = [cwd, workspaceRoot, packageRoot];
  const errors: string[] = [];

  for (const root of requireRoots) {
    try {
      const entry = resolvePackageEntryFrom(root, packageName);
      const packageRoot = await findPackageRoot(entry, packageName);

      return {
        name: packageName,
        root: packageRoot,
        entry,
      };
    } catch (error) {
      if (error instanceof Error) errors.push(error.message);
    }
  }

  const workspacePackageRoot = await findWorkspacePackageRoot(packageName, cwd);

  if (workspacePackageRoot) {
    return {
      name: packageName,
      root: workspacePackageRoot,
      entry: resolvePackageEntryFrom(workspacePackageRoot, packageName),
    };
  }

  throw new Error(
    `Could not resolve content package ${packageName}. ` +
      `Install it as a dependency, run the command from that package, or add it to the pnpm workspace.` +
      (errors.length ? `\n${errors.at(-1)}` : ""),
  );
};

const resolveContentPackageFromConfig = async (
  configPath: string,
): Promise<ContentPackage> => {
  const packageRoot = await findNearestPackageRoot(path.dirname(configPath));

  if (!packageRoot?.name) {
    throw new Error(
      `Could not find a named package.json for config file ${configPath}`,
    );
  }

  return {
    name: packageRoot.name,
    root: packageRoot.root,
    entry: resolvePackageEntryFrom(packageRoot.root, packageRoot.name),
  };
};

export const loadSlidesConfig = async (
  {
    configPath,
    contentPackageName,
    cwd = process.cwd(),
  }: LoadSlidesConfigOptions = {},
): Promise<SlidesConfig> => {
  const contentPackage = contentPackageName
    ? await resolveContentPackage(contentPackageName, cwd)
    : undefined;
  const resolvedConfigPath = configPath
    ? resolveFrom(cwd, configPath)
    : contentPackage
      ? await findPackageConfig(contentPackage.root)
      : await findDefaultConfig(cwd);

  if (!resolvedConfigPath) {
    throw new Error(
      contentPackage
        ? `Could not find ${CONFIG_FILENAMES.join(", ")} in ${contentPackage.root}`
        : `No content package or Slides config file found. Run slides <command> <content-package>.`,
    );
  }

  const resolvedContentPackage =
    contentPackage ?? (await resolveContentPackageFromConfig(resolvedConfigPath));
  const rootDir = resolvedConfigPath ? path.dirname(resolvedConfigPath) : cwd;
  const raw = resolvedConfigPath ? await parseConfigFile(resolvedConfigPath) : {};
  const appDir = resolveFrom(
    rootDir,
    getString(raw.app?.directory, path.join(workspaceRoot, "apps", "slides")),
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
    contentPackageEntry: resolvedContentPackage.entry,
    contentPackageName: resolvedContentPackage.name,
    sourceContentDir: resolvedContentPackage.root,
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
  SLIDES_CONTENT_PACKAGE: config.contentPackageName,
  SLIDES_CONTENT_PACKAGE_ENTRY: config.contentPackageEntry,
  SLIDES_CONTENT_PACKAGE_ROOT: config.sourceContentDir,
});
