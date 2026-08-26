import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";
import sharp from "sharp";

import {
  DEFAULT_ENABLE_WEBP,
  DEFAULT_ENABLE_SIZES,
  DEFAULT_ENABLE_TILES,
  DEFAULT_INPUT_ROOT,
  DEFAULT_TILE_SIZE,
  getResponsiveImageSizes,
  joinPublicId,
  normalizePublicBase,
  parseIiifOptions,
  type BuildIiifOptions,
  type IiifDefaults,
} from "./core.ts";

export type IiifPluginOptions = BuildIiifOptions & {
  outputRoot?: string;
  publicUrl?: string;
};

export type IiifServerCatalogPluginOptions = IiifPluginOptions & {
  enabled?: boolean;
};

const VIRTUAL_MODULE_ID = "virtual:allmaps-iiif/server";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const EMPTY_CATALOG_MODULE =
  'export default { entries: async () => [], get: async () => new Response("Not found", { status: 404 }) };';

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const isTruthy = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;

  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;

  return fallback;
};

const resolveFrom = (root: string, value: string) =>
  path.isAbsolute(value) ? value : path.resolve(root, value);

const optionalEnv = (value: string | undefined) =>
  value && value.trim() ? value : undefined;

const splitModuleId = (id: string) => {
  const queryIndex = id.indexOf("?");

  return {
    filename: queryIndex === -1 ? id : id.slice(0, queryIndex),
    query: queryIndex === -1 ? "" : id.slice(queryIndex + 1),
  };
};

const hasIiifQuery = (id: string) => {
  const { query } = splitModuleId(id);
  if (!query) return false;

  return new URLSearchParams(query).has("iiif");
};

const normalizeFilePath = (filename: string) =>
  decodeURIComponent(filename.replace(/^\/@fs\//, "/"));

const getRelativeImagePath = (filename: string, inputRoot: string) => {
  const absolutePath = path.resolve(normalizeFilePath(filename));
  const absoluteInputRoot = path.resolve(inputRoot);
  const relativePath = path.relative(absoluteInputRoot, absolutePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(
      `IIIF image import is outside iiif.input: ${absolutePath}\n` +
        `Set iiif.input to a common image root that contains this file: ${absoluteInputRoot}`,
    );
  }

  return {
    absolutePath,
    relativePath: relativePath.split(path.sep).join("/"),
  };
};

const getImageDimensions = async (absolutePath: string) => {
  const metadata = await sharp(absolutePath, {
    limitInputPixels: false,
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read image dimensions: ${absolutePath}`);
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
};

function getPluginOptions(
  config: ResolvedConfig,
  options: IiifPluginOptions,
) {
  const publicUrl = normalizePublicBase(
    options.publicUrl ?? process.env.PUBLIC_URL ?? "/",
  );
  const outputRoot =
    options.outputRoot ??
    optionalEnv(process.env.SLIDES_IIIF_CACHE_ROOT) ??
    path.join(config.root, ".svelte-kit", "iiif");
  const inputRoot =
    options.input ?? optionalEnv(process.env.SLIDES_IIIF_INPUT_ROOT);
  const defaults: IiifDefaults = {
    inputRoot: resolveFrom(config.root, DEFAULT_INPUT_ROOT),
    outputRoot: resolveFrom(config.root, outputRoot),
    idBase:
      optionalEnv(process.env.SLIDES_IIIF_ID_BASE) ??
      joinPublicId(publicUrl, "iiif"),
    collectionLabel: optionalEnv(process.env.SLIDES_IIIF_COLLECTION_LABEL),
  };

  return parseIiifOptions(
    publicUrl,
    {
      ...options,
      id: options.id ?? optionalEnv(process.env.SLIDES_IIIF_ID_BASE),
      collectionLabel:
        options.collectionLabel ??
        optionalEnv(process.env.SLIDES_IIIF_COLLECTION_LABEL),
      input: inputRoot ? resolveFrom(config.root, inputRoot) : undefined,
      output: resolveFrom(config.root, options.output ?? outputRoot),
      sizes:
        options.sizes ??
        isTruthy(
          optionalEnv(process.env.SLIDES_IIIF_SIZES),
          DEFAULT_ENABLE_SIZES,
        ),
      tiles:
        options.tiles ??
        isTruthy(
          optionalEnv(process.env.SLIDES_IIIF_TILES),
          DEFAULT_ENABLE_TILES,
        ),
      tileSize:
        options.tileSize ??
        optionalEnv(process.env.SLIDES_IIIF_TILE_SIZE) ??
        String(DEFAULT_TILE_SIZE),
      webp:
        options.webp ??
        isTruthy(
          optionalEnv(process.env.SLIDES_IIIF_WEBP),
          DEFAULT_ENABLE_WEBP,
        ),
    },
    defaults,
  );
}

export function iiifImageAssets(options: IiifPluginOptions = {}): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "allmaps-iiif-image-assets",
    enforce: "pre",
    configResolved(config) {
      resolvedConfig = config;
    },
    async load(id, loadOptions) {
      if (!hasIiifQuery(id)) return;

      const { filename } = splitModuleId(id);
      const catalogOptions = getPluginOptions(resolvedConfig, options);
      const image = getRelativeImagePath(filename, catalogOptions.inputRoot);
      const dimensions = await getImageDimensions(image.absolutePath);
      const metadata = {
        relativePath: image.relativePath,
        ...dimensions,
        sizes: getResponsiveImageSizes(dimensions, catalogOptions.sizes),
        formats: catalogOptions.outputFormats,
      };

      this.addWatchFile(image.absolutePath);

      return loadOptions?.ssr === false
        ? `export default ${JSON.stringify(metadata)};`
        : `export default ${JSON.stringify({ ...image, ...metadata })};`;
    },
  };
}

export function iiifServerCatalog(
  options: IiifServerCatalogPluginOptions = {},
): Plugin {
  let resolvedConfig: ResolvedConfig;

  return {
    name: "allmaps-iiif-server-catalog",
    enforce: "pre",
    configResolved(config) {
      resolvedConfig = config;
    },
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID;
    },
    load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return;
      if (options.enabled === false) return EMPTY_CATALOG_MODULE;

      const catalogOptions = getPluginOptions(resolvedConfig, options);

      return [
        `import { createIiifCatalog } from "@allmaps/sveltekit-iiif";`,
        `import * as content from "@allmaps/slides-content";`,
        `const imageAssetUrls = "imageAssetUrls" in content ? content.imageAssetUrls : {};`,
        `export default createIiifCatalog(${JSON.stringify(catalogOptions)}, imageAssetUrls);`,
      ].join("\n");
    },
  };
}

export function iiifImages(options: IiifServerCatalogPluginOptions = {}) {
  return [
    ...(options.enabled === false ? [] : [iiifImageAssets(options)]),
    iiifServerCatalog(options),
  ];
}
