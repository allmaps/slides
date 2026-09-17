import path from "node:path";
import { readFile } from "node:fs/promises";
import { digest, readJson } from "@allmaps/static-render/cache";
import {
  emptyThumbnails,
  type ThumbnailManifest,
} from "$lib/shared/thumbnails";
const enabled = () =>
  !["0", "false"].includes(process.env.SLIDES_THUMBNAILS_ENABLED ?? "");
const cacheBase = () =>
  process.env.SLIDES_THUMBNAILS_CACHE_ROOT ??
  path.resolve(".svelte-kit/thumbnails");
const namespace = () =>
  digest(process.env.SLIDES_CONTENT_PACKAGE_ROOT ?? "default").slice(0, 16);
const manifestPath = () => path.join(cacheBase(), namespace(), "manifest.json");
const outputPath = (filename: string) =>
  path.join(cacheBase(), "assets", filename);
export async function getThumbnails(
  _build = false,
): Promise<ThumbnailManifest> {
  if (!enabled()) return emptyThumbnails();
  const manifest = await readJson<ThumbnailManifest>(manifestPath());
  if (!manifest && _build)
    throw new Error(
      "Thumbnail manifest is missing. Run slides build to prepare thumbnails first.",
    );
  return manifest ?? emptyThumbnails();
}

export async function thumbnailEntries() {
  const manifest = await getThumbnails();
  return [...assetNames(manifest)].map((filename) => ({ filename }));
}

function assetNames(manifest: ThumbnailManifest) {
  return new Set(
    [
      ...Object.values(manifest.slides).flatMap((slide) => [
        slide.light.path,
        slide.dark.path,
      ]),
      ...Object.values(manifest.layers).map((image) => image.path),
      ...Object.values(manifest.social).map((image) => image.path),
      ...Object.values(manifest.annotations),
    ].map((value) => value.slice("thumbnails/".length)),
  );
}

export async function getThumbnailAsset(filename: string) {
  if (!/^[a-f0-9]{64}\.(webp|jpg|json)$/.test(filename))
    return new Response("Not found", { status: 404 });
  const manifest = await getThumbnails(false);
  if (!assetNames(manifest).has(filename))
    return new Response("Not found", { status: 404 });
  const type = filename.endsWith(".json")
    ? "application/json"
    : filename.endsWith(".jpg")
      ? "image/jpeg"
      : "image/webp";
  try {
    return new Response(new Uint8Array(await readFile(outputPath(filename))), {
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return new Response("Not found", { status: 404 });
    throw error;
  }
}
