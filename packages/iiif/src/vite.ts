import path from "node:path";

import type { Plugin, ResolvedConfig } from "vite";
import sharp from "sharp";

import { getResponsiveImageSizes, parseIiifOptions, type BuildIiifOptions } from "./core.ts";

export type IiifPluginOptions = BuildIiifOptions & {
  outputRoot?: string;
  publicUrl?: string;
};

export type IiifServerCatalogPluginOptions = IiifPluginOptions & {
  enabled?: boolean;
  sourceModule: string;
};

const VIRTUAL_MODULE_ID = "virtual:allmaps-iiif/server";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const EMPTY_CATALOG_MODULE =
  'export default { entries: async () => [], get: async () => new Response("Not found", { status: 404 }) };';

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

function getPluginOptions(config: ResolvedConfig, options: IiifPluginOptions) {
  const publicUrl = options.publicUrl ?? "/";
  return parseIiifOptions(publicUrl, options, {
    inputRoot: path.resolve(config.root, options.input ?? "images"),
    outputRoot: path.resolve(config.root, options.outputRoot ?? path.join(config.cacheDir, "iiif")),
  });
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
  options: IiifServerCatalogPluginOptions,
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
        `import { createIiifCatalog } from "@allmaps/iiif";`,
        `import * as content from ${JSON.stringify(options.sourceModule)};`,
        `const imageAssetUrls = "imageAssetUrls" in content ? content.imageAssetUrls : {};`,
        `export default createIiifCatalog(${JSON.stringify(catalogOptions)}, imageAssetUrls);`,
      ].join("\n");
    },
  };
}

export function iiifImages(options: IiifServerCatalogPluginOptions) {
  return [
    ...(options.enabled === false ? [] : [iiifImageAssets(options)]),
    iiifServerCatalog(options),
  ];
}
