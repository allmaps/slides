import { access, readdir, readFile, realpath, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { parseConfigDocument } from "../model/config.ts";
import { parseSlidesConfig, slidesConfigSchema } from "../model/content-schema.ts";

export type LoadSlidesConfigOptions = {
  content?: string;
  /** Package-name compatibility; directories are the primary interface. */
  contentPackageName?: string;
  configPath?: string;
  cwd?: string;
  cacheDir?: string;
  outDir?: string;
  mode?: "development" | "production";
  publicOverrides?: Record<string, string | undefined>;
};
export type RuntimeSlidesConfig = Awaited<ReturnType<typeof loadSlidesConfig>>;
const CONFIG_FILENAMES = ["slides.config.yml", "slides.config.yaml", "slides.config.json"];
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
export const exists = async (filename: string) => {
  try { await access(filename); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
};
export const booleanOption = (value: unknown, fallback = false) => value === undefined ? fallback
  : !["false", "0", "no", "off", ""].includes(String(value).trim().toLowerCase());

async function findConfig(root: string) {
  for (const name of CONFIG_FILENAMES) {
    const filename = path.join(root, name);
    if (await exists(filename)) return filename;
  }
}
async function resolveContent(target: string, cwd: string): Promise<string> {
  const candidate = path.resolve(cwd, target);
  if (await exists(candidate)) {
    if (!(await stat(candidate)).isDirectory()) throw new Error(`Content must be a directory: ${candidate}`);
    return realpath(candidate);
  }
  if (target.startsWith(".") || path.isAbsolute(target)) throw new Error(`Content directory not found: ${candidate}`);
  // Package metadata, not executable exports, identifies installed content.
  const require = createRequire(path.join(cwd, "package.json"));
  for (const directory of require.resolve.paths(target) ?? []) {
    const root = path.join(directory, target);
    if (await exists(path.join(root, "package.json"))) return realpath(root);
  }
  let root = cwd;
  while (true) {
    const workspace = path.join(root, "pnpm-workspace.yaml");
    if (await exists(workspace)) {
      const config = parse(await readFile(workspace, "utf8"));
      for (const pattern of config.packages ?? []) {
        if (pattern.startsWith("!")) continue;
        const directory = path.resolve(root, pattern.replace(/\/\*$/, ""));
        const candidates = pattern.endsWith("/*") && await exists(directory)
          ? (await readdir(directory, { withFileTypes: true })).filter(e => e.isDirectory()).map(e => path.join(directory, e.name))
          : [directory];
        for (const candidate of candidates) {
          const filename = path.join(candidate, "package.json");
          if (await exists(filename) && JSON.parse(await readFile(filename, "utf8")).name === target) return realpath(candidate);
        }
      }
      break;
    }
    const parent = path.dirname(root);
    if (parent === root) break;
    root = parent;
  }
  throw new Error(`Could not resolve ${target}. Pass a content directory or an installed/workspace content package.`);
}

export async function loadSlidesConfig(options: LoadSlidesConfigOptions = {}) {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const target = options.content ?? options.contentPackageName;
  const configOverride = options.configPath ? path.resolve(cwd, options.configPath) : undefined;
  const sourceContentDir = await resolveContent(target ?? (configOverride ? path.dirname(configOverride) : "."), cwd);
  const configPath = configOverride ?? await findConfig(sourceContentDir);
  if (!configPath) throw new Error(`No ${CONFIG_FILENAMES.join(", ")} in ${sourceContentDir}`);
  const publicOverrides = options.publicOverrides ?? Object.fromEntries(["PUBLIC_URL", "PUBLIC_BASE_PATH", "PUBLIC_PROTOMAPS_KEY"].map(key => [key, process.env[key] ?? "__SLIDES_UNSET__"]));
  const environment = { ...process.env, ...Object.fromEntries(Object.entries(publicOverrides).map(([key, value]) => [key, value === "__SLIDES_UNSET__" ? undefined : value])) };
  const result = slidesConfigSchema.safeParse(parseConfigDocument(await readFile(configPath, "utf8"), configPath, environment));
  if (!result.success) throw new Error(`Invalid Slides config ${configPath}: ${result.error.message}`);
  const raw = result.data;
  const normalized = parseSlidesConfig(raw, configPath);
  if (!normalized.success) throw new Error(`Invalid Slides config ${configPath}`);
  const publicBasePath = String(environment.PUBLIC_BASE_PATH ?? raw.site?.basePath ?? "");
  const publicUrl = String(environment.PUBLIC_URL?.trim() || raw.site?.publicUrl || publicBasePath);
  const protomapsKey = String(raw.protomaps?.key ?? raw.map?.protomaps?.key ?? environment.PUBLIC_PROTOMAPS_KEY ?? "");
  const cacheDir = path.resolve(cwd, options.cacheDir ?? "node_modules/.vite");
  const projectKey = createHash("sha256").update(JSON.stringify([sourceContentDir, configPath, publicBasePath, publicUrl])).digest("hex").slice(0, 20);
  const projectDir = path.join(cacheDir, "slides", "projects", projectKey);
  const workDir = path.join(projectDir, options.mode ?? "production");
  const packagedApp = path.join(packageRoot, "app");
  const sourceApp = path.resolve(packageRoot, "../../apps/slides");
  const appDir = raw.app?.directory ? path.resolve(sourceContentDir, raw.app.directory)
    : await exists(path.join(packageRoot, "src")) && await exists(sourceApp) ? sourceApp : packagedApp;
  const packageJson = path.join(sourceContentDir, "package.json");
  const contentPackageName = await exists(packageJson) ? JSON.parse(await readFile(packageJson, "utf8")).name : undefined;
  return {
    options: { ...options, content: sourceContentDir, configPath, cwd, cacheDir, publicOverrides },
    configPath, rootDir: sourceContentDir, sourceContentDir, appDir, contentPackageName,
    publicBasePath, publicUrl, protomapsKey, cacheDir, projectKey, projectDir, workDir,
    outDir: path.resolve(cwd, options.outDir ?? process.env.SLIDES_BUILD_OUTPUT ?? path.join(sourceContentDir, "dist")),
    raw, slidesConfig: { ...normalized.data, protomaps: { ...normalized.data.protomaps, key: protomapsKey } },
    iiif: {
      enabled: booleanOption(raw.iiif?.enabled, true),
      inputRoot: path.resolve(sourceContentDir, raw.iiif?.input ?? "assets/images"),
      outputRoot: path.resolve(sourceContentDir, raw.iiif?.output ?? "static/iiif"),
      idBase: raw.iiif?.id,
      collectionLabel: raw.iiif?.collectionLabel ?? raw.title,
      sizes: booleanOption(raw.iiif?.sizes, true), tiles: booleanOption(raw.iiif?.tiles, true),
      tileSize: raw.iiif?.tileSize === undefined ? undefined : String(raw.iiif.tileSize),
      webp: booleanOption(raw.iiif?.webp, true),
    },
  };
}

export const getAppEnvironment = (config: RuntimeSlidesConfig): NodeJS.ProcessEnv => ({
  ...process.env,
  PUBLIC_BASE_PATH: config.publicBasePath, PUBLIC_URL: config.publicUrl,
  PUBLIC_PROTOMAPS_KEY: config.protomapsKey,
  PUBLIC_SLIDES_IIIF_ENABLED: String(config.iiif.enabled),
  SLIDES_OPTIONS: JSON.stringify(config.options),
  SLIDES_CONFIG_PATH: config.configPath,
  SLIDES_CONTENT_PACKAGE_ROOT: config.sourceContentDir,
  SLIDES_BUILD_OUTPUT: config.outDir,
  SLIDES_KIT_OUT_DIR: path.join(config.workDir, "svelte-kit"),
  SLIDES_IIIF_ENABLED: String(config.iiif.enabled),
  SLIDES_IIIF_CACHE_ROOT: path.join(config.workDir, "iiif"),
  SLIDES_IIIF_INPUT_ROOT: config.iiif.inputRoot,
  SLIDES_IIIF_ID_BASE: config.iiif.idBase ?? "",
  SLIDES_IIIF_COLLECTION_LABEL: config.iiif.collectionLabel ?? "",
  SLIDES_IIIF_SIZES: String(config.iiif.sizes), SLIDES_IIIF_TILES: String(config.iiif.tiles),
  SLIDES_IIIF_TILE_SIZE: config.iiif.tileSize ?? "1024", SLIDES_IIIF_WEBP: String(config.iiif.webp),
});

export const loadRuntimeConfig = () => loadSlidesConfig(
  process.env.SLIDES_OPTIONS ? JSON.parse(process.env.SLIDES_OPTIONS) : {},
);
