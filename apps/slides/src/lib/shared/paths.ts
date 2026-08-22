import baseUrl from "$lib/shared/base-url";
import { assetUrls } from "@allmaps/slides-content";

const EXTERNAL_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;
const PROJECT_ASSET_FOLDERS = new Set([
  "annotations",
  "geojson",
  "images",
  "sprites",
]);

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

export const getContentAssetUrl = (
  projectFolder: string,
  path: string | null | undefined,
) => {
  const cleanPath = path?.trim();
  if (!cleanPath) return undefined;
  if (isExternalUrl(cleanPath)) return cleanPath;

  const assetPath = normalizeProjectAssetPath(cleanPath);
  const assetKey = `./${projectFolder}/${assetPath}`;

  return assetUrls[assetKey];
};
