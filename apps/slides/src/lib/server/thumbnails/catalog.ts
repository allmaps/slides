import path from "node:path";
import { access, readFile } from "node:fs/promises";
import sharp from "sharp";
import { parseAnnotation } from "@allmaps/annotation";
import { getProject } from "$lib/shared/project";
import { slidesConfig } from "$lib/shared/app-config";
import {
  resolveBasemapStyle,
  getEffectiveBasemapTheme,
  getEffectiveBasemapStyleConfig,
  getEffectiveBasemapLayerState,
} from "$lib/shared/basemap";
import { getGeoJsonLayers } from "$lib/shared/geojson";
import {
  prepareUserLayers,
  applyUserLayerChanges,
} from "$lib/shared/map/layers";
import { layerPreviewKey, hidesBasemap } from "$lib/shared/map/annotations";
import { resolveChapterCamera, type Camera } from "$lib/shared/map/camera";
import {
  emptyThumbnails,
  slidePreviewKey,
  type ThumbnailManifest,
  type Thumbnail,
} from "$lib/shared/thumbnails";
import type {
  MapChapterProps,
  Slideshow,
  ThemeMode,
  WarpedMapProps,
} from "$lib/shared/types";
import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import {
  atomicWrite,
  digest,
  readJson,
  RemoteCache,
  RenderCache,
} from "./cache.ts";
import { NativeRenderer } from "./native.ts";
import { Sources } from "./sources.ts";
import { loadLayer, renderWarpedLayer, type LoadedLayer } from "./warped.ts";
import { sceneStyles, renderBasemap } from "./basemap.ts";

const CACHE_VERSION = 1;
const truthy = (value?: string) => value === "1" || value === "true";
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
let pending: Promise<ThumbnailManifest> | undefined;

export async function getThumbnails(build = true): Promise<ThumbnailManifest> {
  if (!enabled()) return emptyThumbnails();
  if (!build)
    return (
      (await readJson<ThumbnailManifest>(manifestPath())) ?? emptyThumbnails()
    );
  // Shared by the layout and route entries during prerender, including concurrent routes.
  return (pending ??= buildThumbnails().catch((error) => {
    pending = undefined;
    throw error;
  }));
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

async function publish(bytes: Buffer, extension: string) {
  const filename = `${digest(bytes)}.${extension}`;
  try {
    await access(outputPath(filename));
  } catch {
    await atomicWrite(outputPath(filename), bytes);
  }
  return `thumbnails/${filename}`;
}

async function buildThumbnails(): Promise<ThumbnailManifest> {
  const started = performance.now();
  const base = cacheBase();
  const offline = truthy(process.env.SLIDES_THUMBNAILS_OFFLINE);
  const refresh = truthy(process.env.SLIDES_THUMBNAILS_REFRESH);
  const previousEpoch = await readJson<{ epoch: number }>(
    path.join(base, "epoch.json"),
  );
  // A daily source generation also expires finished rasters. No indefinitely stale outputs.
  const epoch = offline
    ? (previousEpoch?.epoch ?? 0)
    : Math.floor(Date.now() / 86_400_000);
  const renderEpoch = refresh ? Date.now() : epoch;
  const annotationCache = new RemoteCache(
    process.env.SLIDES_ANNOTATIONS_CACHE_ROOT ??
      path.resolve(".svelte-kit/annotations"),
    epoch,
    {
      offline,
      refresh,
      validate: (bytes) => {
        if (!parseAnnotation(JSON.parse(bytes.toString())).length)
          throw new Error("Empty georeference annotation");
      },
    },
  );
  const remote = new RemoteCache(path.join(base, "sources"), renderEpoch, {
    offline,
    refresh,
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const headers = new Headers(init?.headers);
      // Protomaps browser keys can be scoped to the site's configured origin.
      // Send that site's identity for its build-time requests too.
      const publicUrl = process.env.PUBLIC_URL;
      if (
        url.hostname === "api.protomaps.com" &&
        publicUrl?.startsWith("https://")
      ) {
        headers.set("Origin", new URL(publicUrl).origin);
        headers.set("Referer", publicUrl);
      }
      return fetch(input, { ...init, headers });
    },
  });
  const cache = new RenderCache(path.join(base, `renders-v${CACHE_VERSION}`));
  const sources = new Sources(
    remote,
    process.env.SLIDES_CONTENT_PACKAGE_ROOT ?? "",
  );
  const native = new NativeRenderer(
    sources,
    path.join(base, "native", String(renderEpoch)),
  );
  const manifest = emptyThumbnails();
  const layers = new Map<string, LoadedLayer>();
  const project = getProject();

  const getLayer = async (props: WarpedMapProps) => {
    const key = layerPreviewKey(props);
    let layer = layers.get(key);
    if (!layer) {
      layer = await loadLayer(props, annotationCache, sources);
      layers.set(key, layer);
      if (layer.annotation && /^https?:/.test(props.url))
        manifest.annotations[props.url] = await publish(
          layer.annotation.bytes,
          "json",
        );
    }
    return layer;
  };

  const saveImage = async (
    png: Buffer,
    size: [number, number],
    format: "webp" | "jpg",
  ): Promise<Thumbnail> => {
    const bytes = await cache.get(
      { version: CACHE_VERSION, encode: format, hash: digest(png), size },
      () =>
        format === "webp"
          ? sharp(png).webp({ quality: 85 }).toBuffer()
          : sharp(png)
              .flatten({ background: "white" })
              .jpeg({ quality: 90 })
              .toBuffer(),
    );
    return {
      path: await publish(bytes, format),
      width: size[0],
      height: size[1],
    };
  };

  const renderScene = async (
    slideshow: Slideshow,
    chapter: MapChapterProps,
    theme: ThemeMode,
    camera: Camera,
    size: [number, number],
    overlayLayers: LayerSpecification[],
    social = false,
  ) => {
    const resolvedTheme = getEffectiveBasemapTheme(
      theme,
      slidesConfig.map,
      slideshow.map,
      chapter.map,
    );
    const config = getEffectiveBasemapStyleConfig({
      theme: resolvedTheme,
      appMap: slidesConfig.map,
      appProtomaps: slidesConfig.protomaps,
      slideshowMap: slideshow.map,
      chapterMap: chapter.map,
    });
    const style = await resolveBasemapStyle({
      theme: resolvedTheme,
      config,
      fetchFn: sources.fetch,
      strict: true,
    });
    const state = getEffectiveBasemapLayerState(
      slidesConfig.map,
      slideshow.map,
      chapter.map,
    );
    const resolvedSources: Record<string, SourceSpecification> =
      structuredClone(slideshow.sources);
    for (const source of Object.values(resolvedSources))
      if (source.type === "geojson" && typeof source.data === "string")
        source.data = JSON.parse(
          (await sources.get(source.data)).bytes.toString(),
        );
    const styles = sceneStyles(
      style,
      state,
      hidesBasemap(chapter),
      resolvedSources,
      overlayLayers,
    );
    const selected = await Promise.all(
      (chapter.warpedMaps ?? []).toReversed().map(getLayer),
    );
    const warped = await cache.get(
      {
        version: CACHE_VERSION,
        kind: "warped-stack",
        camera,
        size,
        revisions: selected.map((layer) => layer.revision),
        renderEpoch,
      },
      async () => {
        const overlays: Buffer[] = [];
        for (const layer of selected)
          overlays.push(
            await renderWarpedLayer(layer, camera, size, sources, cache),
          );
        return sharp({
          create: {
            width: size[0],
            height: size[1],
            channels: 4,
            background: "#00000000",
          },
        })
          .composite(overlays.map((input) => ({ input })))
          .png()
          .toBuffer();
      },
    );
    const png = await cache.get(
      {
        version: CACHE_VERSION,
        compositionVersion: 2,
        camera,
        size,
        styles,
        warped: digest(warped),
        renderEpoch,
        social,
      },
      async () => {
        const lower = await renderBasemap(
          styles.lower,
          camera,
          size,
          native,
          cache,
          renderEpoch,
        );
        const overlays = [{ input: warped }];
        if (styles.upper.layers.length)
          overlays.push({
            input: await renderBasemap(
              styles.upper,
              camera,
              size,
              native,
              cache,
              renderEpoch,
            ),
          });
        return sharp(lower).composite(overlays).png().toBuffer();
      },
    );
    return saveImage(png, size, social ? "jpg" : "webp");
  };

  try {
    for (const slideshow of project.slideshows) {
      console.log(
        `[thumbnails] ${slideshow.id}: ${slideshow.chapters.length} slides`,
      );
      const size: [number, number] = [540, 400];
      let camera: Camera = { center: [0, 0], zoom: 14, bearing: 0 };
      let overlays: LayerSpecification[] = Object.entries(
        slideshow.sources,
      ).flatMap(([id, source]) =>
        source.type === "geojson"
          ? prepareUserLayers(getGeoJsonLayers(id))
          : [],
      );
      const chapters = [
        ...(slideshow.start ? [slideshow.start] : []),
        ...slideshow.chapters,
      ];
      for (const chapter of chapters) {
        if (chapter.sprite)
          throw new Error(
            "Warped sprite previews are not supported; use IIIF image sources",
          );
        const selected = await Promise.all(
          (chapter.warpedMaps ?? []).map(getLayer),
        );
        const mapsFor = (props: WarpedMapProps) =>
          layers.get(layerPreviewKey(props))?.maps ?? [];
        for (const layer of selected) {
          const key = layerPreviewKey(layer.props);
          if (manifest.layers[key]) continue;
          const mapCamera = resolveChapterCamera(
            {
              warpedMaps: [
                {
                  ...layer.props,
                  useZoom: false,
                  useBounds: true,
                  useBearing: false,
                },
              ],
            },
            () => layer.maps,
            [256, 256],
            12,
          );
          manifest.layers[key] = await saveImage(
            await renderWarpedLayer(
              layer,
              mapCamera,
              [256, 256],
              sources,
              cache,
            ),
            [256, 256],
            "webp",
          );
        }
        const previousCamera = camera;
        camera = resolveChapterCamera(chapter, mapsFor, size, 20, camera);
        // Preserve the app's sequential, partial user-layer changes.
        overlays = applyUserLayerChanges(overlays, chapter.layers);
        if (!("slug" in chapter)) continue;
        const key = slidePreviewKey(slideshow.id, String(chapter.slug));
        const light = await renderScene(
          slideshow,
          chapter,
          "light",
          camera,
          size,
          overlays,
        );
        const dark = await renderScene(
          slideshow,
          chapter,
          "dark",
          camera,
          size,
          overlays,
        );
        manifest.slides[key] = { light, dark };
        if (chapter === slideshow.chapters[0]) {
          const socialSize: [number, number] = [1200, 630];
          const socialCamera = resolveChapterCamera(
            chapter,
            mapsFor,
            socialSize,
            32,
            previousCamera,
          );
          manifest.social[slideshow.id] = await renderScene(
            slideshow,
            chapter,
            "light",
            socialCamera,
            socialSize,
            overlays,
            true,
          );
        }
      }
    }
    await atomicWrite(manifestPath(), JSON.stringify(manifest));
    await atomicWrite(
      path.join(base, "epoch.json"),
      JSON.stringify({ epoch: renderEpoch }),
    );
    console.log(
      `[thumbnails] ${Object.keys(manifest.slides).length} slides, ${Object.keys(manifest.layers).length} map variants; ${cache.rendered} jobs rendered, ${cache.reused} reused; ${annotationCache.downloads} annotations downloaded, ${annotationCache.hits} cached; ${Math.round((performance.now() - started) / 1000)}s`,
    );
    return manifest;
  } finally {
    native.close();
    for (const layer of layers.values())
      for (const map of layer.maps) map.destroy();
  }
}
