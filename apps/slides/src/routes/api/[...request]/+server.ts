import { error } from "@sveltejs/kit";
import { dataAssetFiles } from "@allmaps/slides-content";
import type { RequestHandler } from "./$types";

const DATA_ASSET_EXTENSION_PATTERN = /\.(?:geojson|json)$/i;

const joinUrl = (...segments: string[]) =>
  segments
    .flatMap((segment) => segment.split("/"))
    .filter(Boolean)
    .join("/");

const getDataAssetRequestPath = (assetKey: string) => {
  const parts = assetKey.replace(/^\.\//, "").split("/").filter(Boolean);
  const assetsIndex = parts.lastIndexOf("assets");
  const filename = parts.at(-1) ?? "";

  if (assetsIndex === -1 || assetsIndex === parts.length - 1) return undefined;
  if (!DATA_ASSET_EXTENSION_PATTERN.test(filename)) return undefined;

  return joinUrl(
    ...parts.slice(0, assetsIndex),
    ...parts.slice(assetsIndex + 1),
  );
};

const getContentType = (request: string) =>
  request.toLowerCase().endsWith(".geojson")
    ? "application/geo+json; charset=utf-8"
    : "application/json; charset=utf-8";

const dataAssetEntries: Array<[string, () => Promise<string>]> = Object.entries(
  dataAssetFiles,
).flatMap(([assetKey, loadAsset]) => {
  const request = getDataAssetRequestPath(assetKey);

  return request ? [[request, loadAsset]] : [];
});

const dataAssetLoadersByRequestPath = new Map(dataAssetEntries);

export const prerender = true;

export const entries = () =>
  dataAssetEntries.toSorted(([a], [b]) => a.localeCompare(b)).map(
    ([request]) => ({ request }),
  );

export const GET: RequestHandler = async ({ params }) => {
  const request = params.request;
  const loadAsset = request
    ? dataAssetLoadersByRequestPath.get(request)
    : undefined;

  if (!loadAsset) {
    error(404, "Asset not found");
  }

  const contents = await loadAsset();

  return new Response(contents, {
    headers: {
      "content-type": getContentType(request),
      "cache-control": "public, max-age=3600",
    },
  });
};
