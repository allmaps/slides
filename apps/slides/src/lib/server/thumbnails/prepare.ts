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
  type Thumbnail,
} from "$lib/shared/thumbnails";
import type {
  MapChapterProps,
  Slideshow,
  ThemeMode,
  WarpedMapProps,
} from "$lib/shared/types";
import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import { digest } from "@allmaps/static-render/cache";
import { createSourceContext } from "@allmaps/static-render/context";
import { loadLayer, type LoadedLayer } from "@allmaps/static-render/warped";
import { sceneStyles } from "@allmaps/static-render/basemap";
import type { RenderPlan, RenderJob } from "@allmaps/static-render/types";
import { dataAssetFiles, imageAssetUrls } from "$lib/shared/content-package";
import {
  getContentAssetUrl,
  getContentIiifImage,
  withBaseUrl,
} from "$lib/shared/paths";

export async function prepareThumbnails(options: {
  assetRoot: string;
  cacheRoot: string;
  annotationsRoot: string;
  offline: boolean;
  refresh: boolean;
  publicUrl?: string;
}) {
  const assets = {
    images: {} as Record<string, string>,
    data: {} as Record<string, string>,
  };
  for (const key of Object.keys(imageAssetUrls)) {
    const relative = key.replace(/^\.\//, "");
    const iiif = getContentIiifImage(relative);
    const service = iiif
      ? withBaseUrl(`iiif/${iiif.servicePath}`)
      : getContentAssetUrl(relative);
    if (service)
      assets.images[new URL(service, "http://slides.local").pathname] =
        relative;
  }
  for (const key of Object.keys(dataAssetFiles)) {
    const relative = key.replace(/^\.\//, "");
    const url = getContentAssetUrl(relative);
    if (url)
      assets.data[new URL(url, "http://slides.local").pathname] = relative;
  }
  const {
    epoch,
    sources,
    annotations: annotationCache,
  } = await createSourceContext({ ...options, assets });
  const plan: RenderPlan = {
    version: 1,
    epoch,
    publicUrl: options.publicUrl,
    assets,
    layers: {},
    jobs: [],
    resources: {},
  };
  const manifest = emptyThumbnails();
  const layers = new Map<string, LoadedLayer>();
  const project = getProject();

  const getLayer = async (props: WarpedMapProps) => {
    const key = layerPreviewKey(props);
    let layer = layers.get(key);
    if (!layer) {
      layer = await loadLayer(props, annotationCache, sources);
      layers.set(key, layer);
      plan.layers[key] = {
        props: layer.props,
        revision: layer.revision,
        maps: layer.maps.map((map) => ({
          map: map.georeferencedMap,
          options: map.mapOptions,
        })),
      };
      if (layer.annotation && /^https?:/.test(props.url)) {
        plan.resources[props.url] = {
          base64: layer.annotation.bytes.toString("base64"),
          extension: "json",
        };
        manifest.annotations[props.url] = props.url;
      }
    }
    return layer;
  };

  const addJob = (job: Omit<RenderJob, "id">): Thumbnail => {
    const id = `image-${plan.jobs.length}`;
    plan.jobs.push({ id, ...job });
    return { path: id, width: job.size[0], height: job.size[1] };
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
    return addJob({
      layers: selected.map((layer) => layerPreviewKey(layer.props)),
      camera,
      size,
      styles,
      format: social ? "jpg" : "webp",
    });
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
          manifest.layers[key] = addJob({
            layers: [key],
            camera: mapCamera,
            size: [256, 256],
            format: "webp",
          });
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
    console.log(
      `[thumbnails] Prepared ${plan.jobs.length} images; ${annotationCache.downloads} annotations downloaded, ${annotationCache.hits} cached`,
    );
    return { plan, manifest };
  } finally {
    for (const layer of layers.values())
      for (const map of layer.maps) map.destroy();
  }
}
