import baseUrl from "$lib/shared/base-url";

const EXTERNAL_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

export type ProjectAssetUrlOptions = {
  useProjectSubdirectory?: boolean;
};

export const isExternalUrl = (value: string) =>
  EXTERNAL_URL_PATTERN.test(value) || value.startsWith("//");

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

const getProjectAssetPath = (
  projectSlug: string,
  assetPath = "",
  options: ProjectAssetUrlOptions = {},
) =>
  options.useProjectSubdirectory === false
    ? joinUrl("assets", assetPath)
    : joinUrl("assets", projectSlug, assetPath);

export const getProjectAssetBase = (
  projectSlug: string,
  options: ProjectAssetUrlOptions = {},
) => withBaseUrl(getProjectAssetPath(projectSlug, "", options));

export const resolveProjectAssetUrl = (
  projectSlug: string,
  path: string,
  options: ProjectAssetUrlOptions = {},
) => {
  if (isExternalUrl(path)) return path;

  const cleanPath = path.replace(/^\/+/, "");
  const assetPath = cleanPath.startsWith("assets/")
    ? cleanPath.slice("assets/".length)
    : cleanPath;

  return withBaseUrl(getProjectAssetPath(projectSlug, assetPath, options));
};
