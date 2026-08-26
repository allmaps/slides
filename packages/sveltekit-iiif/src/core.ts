import {
  access,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { IIIFBuilder } from "@iiif/builder";
import sharp from "sharp";

export type ResolvedIiifOptions = {
  force: boolean;
  idBase: string;
  collectionLabel: string;
  publicUrl: string;
  inputRoot: string;
  outputRoot: string;
  outputFormats: OutputFormat[];
  sizes: boolean;
  tiles: boolean;
  tileSize: number;
};

export type IiifDefaults = {
  inputRoot: string;
  outputRoot: string;
  idBase?: string;
  collectionLabel?: string;
};

export type BuildIiifOptions = {
  force?: boolean;
  id?: string;
  collectionLabel?: string;
  input?: string;
  output?: string;
  sizes?: boolean;
  tiles?: boolean;
  tileSize?: string;
  webp?: boolean;
};

export type IiifResponsiveImageSize = ImageSize & {
  size: string;
};

export type IiifImageSource = {
  absolutePath: string;
  relativePath?: string;
  width?: number;
  height?: number;
  sizes?: IiifResponsiveImageSize[];
  formats?: OutputFormat[];
};

type IiifImageModule = IiifImageSource | { default: IiifImageSource };

export type IiifImageImports = Record<
  string,
  IiifImageModule | (() => Promise<IiifImageModule>)
>;

export type ImageServiceInfo = {
  "@context": string;
  id: string;
  type: "ImageService3";
  profile: "level0";
  protocol: string;
  extraFormats?: string[];
  preferredFormats?: string[];
  tiles?: Array<{
    scaleFactors?: number[];
    width?: number;
    height?: number;
  }>;
  sizes?: Array<{
    width: number;
    height: number;
  }>;
  width: number;
  height: number;
};

export type ImageSize = {
  width: number;
  height: number;
};

export type OutputFormat = "jpg" | "webp";

type Tile = {
  region: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  outputSize: ImageSize;
};

type RawImage = ImageSize & {
  data: Uint8Array;
  channels: number;
};

export type ImageFile = {
  absolutePath: string;
  relativePath: string;
  relativeDir: string;
  filename: string;
  stem: string;
  sourceId: string;
  outputDir: string;
  infoPath: string;
  serviceBaseId: string;
  expectedInfoId: string;
  mimeType: string;
};

export type ProcessedImage = ImageFile & {
  info: ImageServiceInfo;
  thumbnail: {
    id: string;
    type: "Image";
    format: string;
    width: number;
    height: number;
  };
};

export const DEFAULT_INPUT_ROOT = "static/images";
export const DEFAULT_OUTPUT_ROOT = "static/iiif";
export const DEFAULT_TILE_SIZE = 1024;
export const DEFAULT_ENABLE_SIZES = true;
export const DEFAULT_ENABLE_TILES = true;
export const DEFAULT_COLLECTION_LABEL = "Image Collection";
const FIRST_FIXED_SIZE = 512;
const JPEG_QUALITY = 90;
const WEBP_QUALITY = 90;
const WEBP_MAX_DIMENSION = 16_383;
export const DEFAULT_OUTPUT_FORMAT: OutputFormat = "jpg";
export const DEFAULT_ENABLE_WEBP = true;

const IMAGE_EXTENSIONS = new Map<string, string>([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".webp", "image/webp"],
]);

export function normalizePublicBase(value: string) {
  return value.replace(/\/+$/, "") || "/";
}

export function joinPublicId(base: string, ...segments: string[]) {
  const cleanBase = normalizePublicBase(base);
  const cleanSegments = segments
    .flatMap((segment) => segment.split(/[\\/]+/))
    .filter(Boolean);

  if (!cleanSegments.length) {
    return cleanBase;
  }

  if (cleanBase === "/") {
    return `/${cleanSegments.join("/")}`;
  }

  return `${cleanBase}/${cleanSegments.join("/")}`;
}

function folderLabel(relativeDir: string) {
  if (relativeDir === ".") return "Images";

  return relativeDir
    .split(/[\\/]+/)
    .at(-1)!
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function imageLabel(stem: string) {
  return stem.replace(/[-_]+/g, " ");
}

function getMimeType(filename: string) {
  const extension = path.extname(filename).toLowerCase();
  return IMAGE_EXTENSIONS.get(extension);
}

function parsePositiveInteger(
  value: string | number | undefined,
  fallback: number,
) {
  if (!value) return fallback;

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, received "${value}"`);
  }

  return parsed;
}

export function getOutputFormats(enableWebp: boolean): OutputFormat[] {
  return enableWebp ? [DEFAULT_OUTPUT_FORMAT, "webp"] : [DEFAULT_OUTPUT_FORMAT];
}

export function parseIiifOptions(
  publicUrl: string,
  commandOptions: BuildIiifOptions,
  defaults: IiifDefaults,
): ResolvedIiifOptions {
  const enableWebp = commandOptions.webp ?? DEFAULT_ENABLE_WEBP;
  const normalizedPublicUrl = normalizePublicBase(publicUrl);

  return {
    force: commandOptions.force ?? false,
    idBase: normalizePublicBase(
      commandOptions.id ??
        defaults.idBase ??
        joinPublicId(normalizedPublicUrl, "iiif"),
    ),
    collectionLabel:
      commandOptions.collectionLabel ??
      defaults.collectionLabel ??
      DEFAULT_COLLECTION_LABEL,
    publicUrl: normalizedPublicUrl,
    inputRoot: path.resolve(commandOptions.input ?? defaults.inputRoot),
    outputRoot: path.resolve(commandOptions.output ?? defaults.outputRoot),
    outputFormats: getOutputFormats(enableWebp),
    sizes: commandOptions.sizes ?? DEFAULT_ENABLE_SIZES,
    tiles: commandOptions.tiles ?? DEFAULT_ENABLE_TILES,
    tileSize: parsePositiveInteger(commandOptions.tileSize, DEFAULT_TILE_SIZE),
  };
}

async function findImageFiles(
  inputRoot: string,
  outputRoot: string,
  idBase: string,
) {
  const files: ImageFile[] = [];

  async function walk(directory: string) {
    const entries = await readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const mimeType = getMimeType(entry.name);
      if (!mimeType) continue;

      const relativePath = path.relative(inputRoot, absolutePath);
      files.push(
        createImageFile(
          {
            absolutePath,
            relativePath,
          },
          {
            outputRoot,
            idBase,
          },
        ),
      );
    }
  }

  await walk(inputRoot);

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function normalizeImageRelativePath(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const cleanPath = path.posix.normalize(normalized).replace(/^\.?\//, "");

  if (
    !cleanPath ||
    cleanPath === "." ||
    cleanPath.startsWith("../") ||
    cleanPath.includes("/../") ||
    path.posix.isAbsolute(cleanPath)
  ) {
    throw new Error(`Invalid IIIF image path: ${relativePath}`);
  }

  return cleanPath;
}

function createImageFile(
  source: IiifImageSource,
  options: {
    outputRoot: string;
    idBase: string;
  },
) {
  const absolutePath = path.resolve(source.absolutePath);
  const relativePath = normalizeImageRelativePath(
    source.relativePath ?? path.relative(process.cwd(), absolutePath),
  );
  const filename = path.posix.basename(relativePath);
  const mimeType = getMimeType(filename);

  if (!mimeType) {
    throw new Error(`Unsupported IIIF image type: ${absolutePath}`);
  }

  const relativeDir = path.posix.dirname(relativePath);
  const stem = path.posix.parse(filename).name;
  const outputDir = path.join(options.outputRoot, relativeDir, stem);
  const publicFolderId = joinPublicId(
    options.idBase,
    relativeDir === "." ? "" : relativeDir,
  );
  const expectedInfoId = joinPublicId(publicFolderId, stem);
  const sourceId = `${expectedInfoId}/full/max/0/default.jpg`;

  return {
    absolutePath,
    relativePath,
    relativeDir,
    filename,
    stem,
    sourceId,
    outputDir,
    infoPath: path.join(outputDir, "info.json"),
    serviceBaseId: publicFolderId,
    expectedInfoId,
    mimeType: "image/jpeg",
  };
}

function assertUniqueDerivativePaths(files: ImageFile[]) {
  const sourcesByOutputDir = new Map<string, string[]>();

  for (const file of files) {
    const sources = sourcesByOutputDir.get(file.outputDir) ?? [];
    sources.push(file.relativePath);
    sourcesByOutputDir.set(file.outputDir, sources);
  }

  const conflicts = [...sourcesByOutputDir.entries()].filter(
    ([, sources]) => sources.length > 1,
  );

  if (conflicts.length) {
    const details = conflicts
      .map(([, sources]) => `- ${sources.join(", ")}`)
      .join("\n");
    throw new Error(
      `Multiple source images would create the same IIIF id:\n${details}`,
    );
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

async function readInfoJson(infoPath: string) {
  const contents = await readFile(infoPath, "utf8");
  return JSON.parse(contents) as ImageServiceInfo;
}

function getImageSize(metadata: sharp.Metadata): ImageSize {
  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image width and height");
  }

  return {
    width: metadata.width,
    height: metadata.height,
  };
}

function getScaleFactors({ width, height }: ImageSize, tileSize: number) {
  const scaleFactors: number[] = [];
  let scaleFactor = 1;

  while (true) {
    scaleFactors.push(scaleFactor);

    if (
      Math.ceil(width / scaleFactor) <= tileSize &&
      Math.ceil(height / scaleFactor) <= tileSize
    ) {
      break;
    }

    scaleFactor *= 2;
  }

  return scaleFactors;
}

function getScaledSize({ width, height }: ImageSize, maxDimension: number) {
  const imageMaxDimension = Math.max(width, height);
  const scale = maxDimension / imageMaxDimension;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getFixedSizes(size: ImageSize) {
  const maxDimension = Math.max(size.width, size.height);
  const sizes: ImageSize[] = [];

  for (
    let fixedSize = FIRST_FIXED_SIZE;
    fixedSize < maxDimension;
    fixedSize *= 2
  ) {
    sizes.push(getScaledSize(size, fixedSize));
  }

  return sizes;
}

export function getResponsiveImageSizes(size: ImageSize, includeSizes = true) {
  return [
    ...(includeSizes
      ? getFixedSizes(size).map((fixedSize) => ({
          ...fixedSize,
          size: getSizeSegment(fixedSize),
        }))
      : []),
    {
      ...size,
      size: "max",
    },
  ];
}

function getTiles(size: ImageSize, tileSize: number, scaleFactor: number) {
  const tiles: Tile[] = [];
  const sourceTileSize = tileSize * scaleFactor;

  for (let top = 0; top < size.height; top += sourceTileSize) {
    for (let left = 0; left < size.width; left += sourceTileSize) {
      const width = Math.min(sourceTileSize, size.width - left);
      const height = Math.min(sourceTileSize, size.height - top);

      tiles.push({
        region: {
          left,
          top,
          width,
          height,
        },
        outputSize: {
          width: Math.ceil(width / scaleFactor),
          height: Math.ceil(height / scaleFactor),
        },
      });
    }
  }

  return tiles;
}

function getTileRegionSegment(tile: Tile) {
  const { left, top, width, height } = tile.region;
  return `${left},${top},${width},${height}`;
}

function getSizeSegment(size: ImageSize) {
  return `${size.width},${size.height}`;
}

function getOutputFilename(format: OutputFormat) {
  return `default.${format}`;
}

function canWriteFormat(format: OutputFormat, size: ImageSize) {
  return (
    format === "jpg" ||
    (size.width <= WEBP_MAX_DIMENSION && size.height <= WEBP_MAX_DIMENSION)
  );
}

function getWritableFormats(size: ImageSize, outputFormats: OutputFormat[]) {
  return outputFormats.filter((format) => canWriteFormat(format, size));
}

function getFullMaxPath(file: ImageFile, format = DEFAULT_OUTPUT_FORMAT) {
  return path.join(
    file.outputDir,
    "full",
    "max",
    "0",
    getOutputFilename(format),
  );
}

function getFixedSizePath(
  file: ImageFile,
  size: ImageSize,
  format = DEFAULT_OUTPUT_FORMAT,
) {
  return path.join(
    file.outputDir,
    "full",
    getSizeSegment(size),
    "0",
    getOutputFilename(format),
  );
}

function getTilePath(
  file: ImageFile,
  tile: Tile,
  format = DEFAULT_OUTPUT_FORMAT,
) {
  return path.join(
    file.outputDir,
    getTileRegionSegment(tile),
    getSizeSegment(tile.outputSize),
    "0",
    getOutputFilename(format),
  );
}

function createInfoJson(
  file: ImageFile,
  size: ImageSize,
  options: ResolvedIiifOptions,
): ImageServiceInfo {
  const scaleFactors = getScaleFactors(size, options.tileSize);
  const info: ImageServiceInfo = {
    "@context": "http://iiif.io/api/image/3/context.json",
    id: file.expectedInfoId,
    type: "ImageService3",
    profile: "level0",
    protocol: "http://iiif.io/api/image",
    width: size.width,
    height: size.height,
  };

  if (options.tiles) {
    info.tiles = [
      {
        scaleFactors,
        width: options.tileSize,
        height: options.tileSize,
      },
    ];
  }

  if (options.sizes) {
    info.sizes = getFixedSizes(size);
  }

  if (options.outputFormats.includes("webp")) {
    info.extraFormats = ["webp"];
    info.preferredFormats = ["webp", "jpg"];
  }

  return info;
}

async function getExpectedInfo(file: ImageFile, options: ResolvedIiifOptions) {
  const metadata = await sharp(file.absolutePath, {
    limitInputPixels: false,
  }).metadata();

  return createInfoJson(file, getImageSize(metadata), options);
}

function getExpectedTilePaths(
  file: ImageFile,
  info: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  const scaleFactors = info.tiles?.[0]?.scaleFactors ?? [];
  const imageSize = {
    width: info.width,
    height: info.height,
  };

  return scaleFactors.flatMap((scaleFactor) => {
    const tiles = getTiles(
      imageSize,
      info.tiles?.[0]?.width ?? DEFAULT_TILE_SIZE,
      scaleFactor,
    );

    return tiles.flatMap((tile) =>
      getWritableFormats(tile.outputSize, outputFormats).map((format) =>
        getTilePath(file, tile, format),
      ),
    );
  });
}

function getExpectedDerivativePaths(
  file: ImageFile,
  info: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  const imageSize = {
    width: info.width,
    height: info.height,
  };

  return [
    ...getWritableFormats(imageSize, outputFormats).map((format) =>
      getFullMaxPath(file, format),
    ),
    ...(info.sizes ?? []).flatMap((size) =>
      getWritableFormats(size, outputFormats).map((format) =>
        getFixedSizePath(file, size, format),
      ),
    ),
    ...getExpectedTilePaths(file, info, outputFormats),
  ];
}

function normalizeInfoForComparison(info: ImageServiceInfo, id = info.id) {
  const normalized: ImageServiceInfo = {
    "@context": info["@context"],
    id,
    type: info.type,
    profile: info.profile,
    protocol: info.protocol,
    tiles: info.tiles,
    sizes: info.sizes,
    width: info.width,
    height: info.height,
  };

  if (info.extraFormats) {
    normalized.extraFormats = info.extraFormats;
  }

  if (info.preferredFormats) {
    normalized.preferredFormats = info.preferredFormats;
  }

  return normalized;
}

function isInfoCurrent(actual: ImageServiceInfo, expected: ImageServiceInfo) {
  return (
    JSON.stringify(normalizeInfoForComparison(actual, expected.id)) ===
    JSON.stringify(normalizeInfoForComparison(expected))
  );
}

async function isDerivativeCurrent(
  file: ImageFile,
  actualInfo: ImageServiceInfo,
  expectedInfo: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  if (!isInfoCurrent(actualInfo, expectedInfo)) {
    return false;
  }

  const expectedPaths = getExpectedDerivativePaths(
    file,
    expectedInfo,
    outputFormats,
  );

  for (const expectedPath of expectedPaths) {
    if (!(await fileExists(expectedPath))) {
      return false;
    }
  }

  return true;
}

async function createRawImage(sourcePath: string, size: ImageSize) {
  const { data, info } = await sharp(sourcePath, { limitInputPixels: false })
    .resize(size.width, size.height, { fit: "fill" })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

async function writeRawDerivativeImage(
  image: RawImage,
  outputPath: string,
  format: OutputFormat,
  extract?: sharp.Region,
) {
  await mkdir(path.dirname(outputPath), { recursive: true });

  let pipeline = sharp(image.data, {
    raw: {
      width: image.width,
      height: image.height,
      channels: image.channels as sharp.Channels,
    },
  });

  if (extract) {
    pipeline = pipeline.extract(extract);
  }

  if (format === "webp") {
    await pipeline.webp({ quality: WEBP_QUALITY }).toFile(outputPath);
  } else {
    await pipeline.jpeg({ quality: JPEG_QUALITY }).toFile(outputPath);
  }
}

async function writeRawDerivativeImages(
  image: RawImage,
  outputPathForFormat: (format: OutputFormat) => string,
  outputSize: ImageSize,
  outputFormats: OutputFormat[],
  extract?: sharp.Region,
) {
  for (const format of getWritableFormats(outputSize, outputFormats)) {
    await writeRawDerivativeImage(
      image,
      outputPathForFormat(format),
      format,
      extract,
    );
  }
}

async function writeFixedSizeDerivatives(
  file: ImageFile,
  info: ImageServiceInfo,
  outputFormats: OutputFormat[],
) {
  const imageSize = {
    width: info.width,
    height: info.height,
  };
  const fullImage = await createRawImage(file.absolutePath, imageSize);

  await writeRawDerivativeImages(
    fullImage,
    (format) => getFullMaxPath(file, format),
    imageSize,
    outputFormats,
  );

  for (const size of info.sizes ?? []) {
    const resizedImage = await createRawImage(file.absolutePath, size);

    await writeRawDerivativeImages(
      resizedImage,
      (format) => getFixedSizePath(file, size, format),
      size,
      outputFormats,
    );
  }
}

function getLevelSize(size: ImageSize, scaleFactor: number) {
  return {
    width: Math.ceil(size.width / scaleFactor),
    height: Math.ceil(size.height / scaleFactor),
  };
}

function getLevelTileRegion(
  levelSize: ImageSize,
  tile: Tile,
  scaleFactor: number,
) {
  const left = Math.floor(tile.region.left / scaleFactor);
  const top = Math.floor(tile.region.top / scaleFactor);

  return {
    left,
    top,
    width: Math.min(tile.outputSize.width, levelSize.width - left),
    height: Math.min(tile.outputSize.height, levelSize.height - top),
  };
}

async function writeTileDerivatives(
  file: ImageFile,
  info: ImageServiceInfo,
  tileSize: number,
  outputFormats: OutputFormat[],
) {
  const imageSize = {
    width: info.width,
    height: info.height,
  };
  const scaleFactors = info.tiles?.[0]?.scaleFactors ?? [];

  for (const scaleFactor of scaleFactors) {
    const levelSize = getLevelSize(imageSize, scaleFactor);
    const levelImage = await createRawImage(file.absolutePath, levelSize);

    for (const tile of getTiles(imageSize, tileSize, scaleFactor)) {
      const levelTileRegion = getLevelTileRegion(levelSize, tile, scaleFactor);

      await writeRawDerivativeImages(
        levelImage,
        (format) => getTilePath(file, tile, format),
        {
          width: levelTileRegion.width,
          height: levelTileRegion.height,
        },
        outputFormats,
        levelTileRegion,
      );
    }
  }
}

async function writeDerivatives(
  file: ImageFile,
  info: ImageServiceInfo,
  options: ResolvedIiifOptions,
) {
  await rm(file.outputDir, { recursive: true, force: true });
  await mkdir(file.outputDir, { recursive: true });
  await writeFixedSizeDerivatives(file, info, options.outputFormats);
  await writeTileDerivatives(
    file,
    info,
    options.tileSize,
    options.outputFormats,
  );
  await writeJson(file.infoPath, info);
}

function createThumbnail(info: ImageServiceInfo) {
  const thumbnailSize = info.sizes?.[0] ?? {
    width: info.width,
    height: info.height,
  };
  const sizeSegment = info.sizes?.[0] ? getSizeSegment(thumbnailSize) : "max";

  return {
    id: `${info.id}/full/${sizeSegment}/0/default.jpg`,
    type: "Image" as const,
    format: "image/jpeg",
    width: thumbnailSize.width,
    height: thumbnailSize.height,
  };
}

async function createTiles(file: ImageFile, options: ResolvedIiifOptions) {
  const expectedInfo = await getExpectedInfo(file, options);
  const derivativeExists = await fileExists(file.infoPath);

  if (derivativeExists && !options.force) {
    const currentInfo = await readInfoJson(file.infoPath);

    if (
      await isDerivativeCurrent(
        file,
        currentInfo,
        expectedInfo,
        options.outputFormats,
      )
    ) {
      if (currentInfo.id !== expectedInfo.id) {
        await writeJson(file.infoPath, expectedInfo);
        console.log(`update ${path.relative(process.cwd(), file.infoPath)} id`);
      }

      console.log(`skip   ${file.relativePath}`);
      return expectedInfo;
    }
  }

  await writeDerivatives(file, expectedInfo, options);

  const action = derivativeExists
    ? options.force
      ? "force "
      : "update"
    : "create";
  console.log(`${action} ${file.relativePath}`);

  return expectedInfo;
}

function createManifest(
  relativeDir: string,
  images: ProcessedImage[],
  options: ResolvedIiifOptions,
) {
  const builder = new IIIFBuilder();
  const folderId = joinPublicId(
    options.idBase,
    relativeDir === "." ? "" : relativeDir,
  );
  const manifestId = joinPublicId(folderId, "manifest.json");
  const manifest = builder.createManifest(manifestId, (manifestBuilder) => {
    manifestBuilder.addLabel(folderLabel(relativeDir), "en");

    const firstThumbnail = images[0]?.thumbnail;
    if (firstThumbnail) {
      manifestBuilder.addThumbnail(firstThumbnail);
    }

    for (const image of images) {
      const canvasId = joinPublicId(folderId, "canvas", image.stem);
      manifestBuilder.createCanvas(canvasId, (canvas) => {
        canvas.addLabel(imageLabel(image.stem), "none");
        canvas.width = image.info.width;
        canvas.height = image.info.height;
        canvas.addThumbnail(image.thumbnail);
        canvas.createAnnotation(`${canvasId}/annotation`, {
          id: `${canvasId}/annotation`,
          type: "Annotation",
          motivation: "painting",
          target: canvasId,
          body: {
            id: image.sourceId,
            type: "Image",
            format: image.mimeType,
            width: image.info.width,
            height: image.info.height,
            service: [
              {
                id: image.info.id,
                type: "ImageService3",
                profile: "level0",
              },
            ],
          },
        });
      });
    }
  });

  return {
    id: manifest.id,
    json: builder.toPresentation3({
      id: manifest.id,
      type: "Manifest",
    }),
  };
}

function createCollection(
  manifests: Array<{
    id: string;
    label: string;
    thumbnail?: ProcessedImage["thumbnail"];
  }>,
  options: ResolvedIiifOptions,
) {
  const builder = new IIIFBuilder();
  const collectionId = joinPublicId(options.idBase, "collection.json");
  const collection = builder.createCollection(
    collectionId,
    (collectionBuilder) => {
      collectionBuilder.addLabel(options.collectionLabel, "en");

      const firstThumbnail = manifests[0]?.thumbnail;
      if (firstThumbnail) {
        collectionBuilder.addThumbnail(firstThumbnail);
      }

      for (const manifest of manifests) {
        collectionBuilder.createManifest(manifest.id, (manifestBuilder) => {
          manifestBuilder.addLabel(manifest.label, "en");
          if (manifest.thumbnail) {
            manifestBuilder.addThumbnail(manifest.thumbnail);
          }
        });
      }
    },
  );

  return builder.toPresentation3({
    id: collection.id,
    type: "Collection",
  });
}

async function writeJson(filePath: string, data: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function groupImagesByFolder(images: ProcessedImage[]) {
  const imagesByFolder = new Map<string, ProcessedImage[]>();

  for (const image of images) {
    const imagesInFolder = imagesByFolder.get(image.relativeDir) ?? [];
    imagesInFolder.push(image);
    imagesByFolder.set(image.relativeDir, imagesInFolder);
  }

  return [...imagesByFolder.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export type BuildStaticIiifSettings = {
  failOnEmpty?: boolean;
  images?: IiifImageSource[];
};

export type BuildStaticIiifResult = {
  files: string[];
  images: ProcessedImage[];
  options: ResolvedIiifOptions;
};

export type IiifCatalog = {
  entries: () => Promise<Array<{ request: string }>>;
  get: (
    request: string | undefined,
    options?: {
      publicUrl?: string;
    },
  ) => Promise<Response>;
};

const MIME_TYPES = new Map<string, string>([
  [".avif", "image/avif"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function getContentType(filePath: string) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase());
}

export async function buildStaticIiif(
  options: ResolvedIiifOptions,
  { failOnEmpty = true, images }: BuildStaticIiifSettings = {},
): Promise<BuildStaticIiifResult> {
  if (!images && !(await fileExists(options.inputRoot))) {
    if (failOnEmpty) {
      throw new Error(`No image files found in ${options.inputRoot}`);
    }

    return {
      files: [],
      images: [],
      options,
    };
  }

  const files = images
    ? images
        .map((source) =>
          createImageFile(source, {
            outputRoot: options.outputRoot,
            idBase: options.idBase,
          }),
        )
        .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    : await findImageFiles(
        options.inputRoot,
        options.outputRoot,
        options.idBase,
      );

  if (!files.length) {
    if (failOnEmpty) {
      throw new Error(`No image files found in ${options.inputRoot}`);
    }

    return {
      files: [],
      images: [],
      options,
    };
  }

  assertUniqueDerivativePaths(files);

  console.log(`Found ${files.length} image files:`);
  files.forEach((file) => console.log(`- ${file.relativePath}`));

  const outputFiles = new Set<string>();
  const addOutputFile = (filePath: string) => {
    outputFiles.add(
      path.relative(options.outputRoot, filePath).split(path.sep).join("/"),
    );
  };

  const processedImages: ProcessedImage[] = [];
  for (const file of files) {
    const info = await createTiles(file, options);
    addOutputFile(file.infoPath);
    getExpectedDerivativePaths(file, info, options.outputFormats).forEach(
      addOutputFile,
    );
    processedImages.push({
      ...file,
      info,
      thumbnail: createThumbnail(info),
    });
  }

  const manifestItems = [];

  for (const [relativeDir, images] of groupImagesByFolder(processedImages)) {
    const { id, json } = createManifest(relativeDir, images, options);
    const manifestPath = path.join(
      options.outputRoot,
      relativeDir,
      "manifest.json",
    );

    await writeJson(manifestPath, json);
    addOutputFile(manifestPath);
    manifestItems.push({
      id,
      label: folderLabel(relativeDir),
      thumbnail: images[0]?.thumbnail,
    });
    console.log(`write  ${path.relative(process.cwd(), manifestPath)}`);
  }

  const collection = createCollection(manifestItems, options);
  const collectionPath = path.join(options.outputRoot, "collection.json");
  await writeJson(collectionPath, collection);
  addOutputFile(collectionPath);
  console.log(`write  ${path.relative(process.cwd(), collectionPath)}`);

  return {
    files: [...outputFiles].sort((a, b) => a.localeCompare(b)),
    images: processedImages,
    options,
  };
}

function withPublicUrl(options: ResolvedIiifOptions, publicUrl?: string) {
  if (!publicUrl) return options;

  const normalizedPublicUrl = normalizePublicBase(publicUrl);
  const defaultIdBase = normalizePublicBase(
    joinPublicId(options.publicUrl, "iiif"),
  );
  const shouldUpdateIdBase = options.idBase === defaultIdBase;

  return {
    ...options,
    publicUrl: normalizedPublicUrl,
    idBase: shouldUpdateIdBase
      ? joinPublicId(normalizedPublicUrl, "iiif")
      : options.idBase,
  };
}

function resolveOutputRequest(outputRoot: string, request: string | undefined) {
  if (!request) return undefined;

  const cleanRequest = request.split("/").filter(Boolean).join("/");
  if (!cleanRequest) return undefined;

  const absolutePath = path.resolve(outputRoot, ...cleanRequest.split("/"));
  const normalizedOutputRoot = path.resolve(outputRoot);
  if (
    absolutePath !== normalizedOutputRoot &&
    !absolutePath.startsWith(`${normalizedOutputRoot}${path.sep}`)
  ) {
    return undefined;
  }

  return absolutePath;
}

const isIiifImageSource = (value: unknown): value is IiifImageSource =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { absolutePath?: unknown }).absolutePath === "string";

const unwrapImageModule = (mod: IiifImageModule) => {
  const source =
    typeof mod === "object" && mod !== null && "default" in mod
      ? mod.default
      : mod;

  if (!isIiifImageSource(source)) {
    throw new Error(
      "Invalid IIIF image import. Make sure @allmaps/sveltekit-iiif/vite is enabled before Vite's asset plugin.",
    );
  }

  return source;
};

async function resolveImageImports(imports: IiifImageImports | undefined) {
  if (!imports) return undefined;

  const images: IiifImageSource[] = [];

  for (const value of Object.values(imports)) {
    const mod = typeof value === "function" ? await value() : value;
    images.push(unwrapImageModule(mod));
  }

  return images;
}

export function createIiifCatalog(
  options: ResolvedIiifOptions,
  imageImports?: IiifImageImports,
): IiifCatalog {
  const buildPromises = new Map<string, Promise<BuildStaticIiifResult>>();
  const imageSourcesPromise = resolveImageImports(imageImports);

  const ensureBuilt = (publicUrl?: string) => {
    const buildOptions = withPublicUrl(options, publicUrl);
    const buildKey = `${buildOptions.publicUrl}\0${buildOptions.idBase}`;
    let buildPromise = buildPromises.get(buildKey);

    if (!buildPromise) {
      buildPromise = imageSourcesPromise.then((images) =>
        buildStaticIiif(buildOptions, {
          failOnEmpty: false,
          images,
        }),
      );
      buildPromises.set(buildKey, buildPromise);
    }

    return buildPromise;
  };

  return {
    entries: async () => {
      const result = await ensureBuilt();

      return result.files.map((request) => ({ request }));
    },
    get: async (request, requestOptions) => {
      await ensureBuilt(requestOptions?.publicUrl);

      const filePath = resolveOutputRequest(options.outputRoot, request);
      if (!filePath || !(await fileExists(filePath))) {
        return new Response("Not found", { status: 404 });
      }

      const headers = new Headers();
      const contentType = getContentType(filePath);
      if (contentType) headers.set("content-type", contentType);
      headers.set("access-control-allow-origin", "*");

      return new Response(await readFile(filePath), { headers });
    },
  };
}
