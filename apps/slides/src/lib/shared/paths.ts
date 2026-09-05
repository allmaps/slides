import baseUrl from "$lib/shared/base-url";
import { env } from "$env/dynamic/public";
import { imageAssetUrls } from "@allmaps/slides-content";

const EXTERNAL_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const PROJECT_ASSET_FOLDERS = new Set([
  "annotations",
  "geojson",
  "images",
  "sprites",
]);
const DATA_ASSET_EXTENSION_PATTERN = /\.(?:geojson|json)$/i;
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

type IiifImageModule = {
  relativePath?: string;
  width?: number;
  height?: number;
  sizes?: Array<{
    width: number;
    height: number;
    size: string;
  }>;
  formats?: string[];
};

type ImageModule = IiifImageModule | string;

export type ContentIiifImage = {
  servicePath: string;
  width?: number;
  height?: number;
  sizes: Array<{
    width: number;
    height: number;
    size: string;
  }>;
  formats: string[];
};

export const isExternalUrl = (value: string | null | undefined) =>
  typeof value === "string" &&
  (EXTERNAL_URL_PATTERN.test(value) || value.startsWith("//"));

export const joinUrl = (...segments: string[]) => {
  const cleanSegments = segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean);

  const leadingSlash = segments[0]?.startsWith("/") ? "/" : "";
  const trailingSlash = segments.at(-1)?.endsWith("/") ? "/" : "";

  return `${leadingSlash}${cleanSegments.join("/")}${trailingSlash}`;
};

export const withBaseUrl = (path: string) => {
  if (isExternalUrl(path)) return path;

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");

  if (!cleanBase) return `/${cleanPath}`;
  if (!cleanPath) return cleanBase;

  return `${cleanBase}/${cleanPath}`;
};

const normalizeProjectAssetPath = (path: string) => {
  const cleanPath = path.replace(/^\.?\//, "");
  if (cleanPath.startsWith("assets/")) return cleanPath;

  const [firstSegment] = cleanPath.split("/");
  if (PROJECT_ASSET_FOLDERS.has(firstSegment)) {
    return joinUrl("assets", cleanPath);
  }

  return cleanPath;
};

const getContentAssetKey = (projectFolder: string, assetPath: string) =>
  projectFolder ? `./${projectFolder}/${assetPath}` : `./${assetPath}`;

const resolveContentImage = (
  projectFolder: string,
  assetPath: string,
): ImageModule | undefined => {
  const assetKey = getContentAssetKey(projectFolder, assetPath);

  return imageAssetUrls[assetKey] ?? imageAssetUrls[`./${assetPath}`];
};

const isContentDataAssetPath = (path: string) =>
  path.startsWith("assets/") && DATA_ASSET_EXTENSION_PATTERN.test(path);

const getContentDataAssetRequestPath = (
  projectFolder: string,
  assetPath: string,
) => {
  const pathWithinAssets = assetPath.replace(/^assets\//, "");

  return projectFolder
    ? joinUrl(projectFolder, pathWithinAssets)
    : pathWithinAssets;
};

export const getContentDataAssetUrl = (
  projectFolder: string,
  path: string | null | undefined,
) => {
  const cleanPath = path?.trim();
  if (!cleanPath) return undefined;
  if (isExternalUrl(cleanPath)) return cleanPath;

  const assetPath = normalizeProjectAssetPath(cleanPath);
  if (!isContentDataAssetPath(assetPath)) return undefined;

  return withBaseUrl(
    joinUrl("api", getContentDataAssetRequestPath(projectFolder, assetPath)),
  );
};

const isIiifEnabled = () =>
  !FALSE_VALUES.has(
    env.PUBLIC_SLIDES_IIIF_ENABLED?.trim().toLowerCase() ?? "",
  );

const removeExtension = (path: string) => path.replace(/\.[^/.]+$/, "");

export const getContentAssetUrl = (
  projectFolder: string,
  path: string | null | undefined,
) => {
  const cleanPath = path?.trim();
  if (!cleanPath) return undefined;
  if (isExternalUrl(cleanPath)) return cleanPath;

  const assetPath = normalizeProjectAssetPath(cleanPath);
  const dataAssetUrl = getContentDataAssetUrl(projectFolder, assetPath);
  if (dataAssetUrl) return dataAssetUrl;

  const image = resolveContentImage(projectFolder, assetPath);

  return typeof image === "string" ? image : undefined;
};

export const getContentIiifImage = (
  projectFolder: string,
  path: string | null | undefined,
): ContentIiifImage | undefined => {
  const cleanPath = path?.trim();
  if (!cleanPath || !isIiifEnabled()) return undefined;
  if (isExternalUrl(cleanPath) || cleanPath.startsWith("data:")) {
    return undefined;
  }

  const assetPath = normalizeProjectAssetPath(cleanPath);
  const image = resolveContentImage(projectFolder, assetPath);

  if (!image || typeof image === "string") return undefined;

  const relativePath =
    image.relativePath ?? assetPath.replace(/^assets\/images\//, "");
  const servicePath = removeExtension(relativePath);
  const fallbackSize =
    image.width && image.height
      ? [{ width: image.width, height: image.height, size: "max" }]
      : [];
  const sizes = image.sizes?.length ? image.sizes : fallbackSize;

  if (!sizes.length) return undefined;

  return {
    servicePath,
    width: image.width,
    height: image.height,
    sizes,
    formats: image.formats?.length ? image.formats : ["jpg"],
  };
};
