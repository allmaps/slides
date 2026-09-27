import path from "node:path";
import { readFile, realpath } from "node:fs/promises";
import {
  resolveBasemapStyle,
  getEffectiveBasemapTheme,
  getEffectiveBasemapStyleConfig,
  getEffectiveBasemapLayerState,
} from "../model/basemap.ts";
import { getGeoJsonLayers } from "../model/geojson.ts";
import {
  prepareUserLayers,
  applyUserLayerChanges,
} from "../model/map/layers.ts";
import { layerPreviewKey, hidesBasemap } from "../model/map/annotations.ts";
import { resolveChapterCamera, type Camera } from "../model/map/camera.ts";
import {
  emptyThumbnails,
  slidePreviewKey,
  type Thumbnail,
} from "../model/thumbnails.ts";
import type {
  MapChapterProps,
  Slideshow,
  ThemeMode,
  WarpedMapProps,
} from "../model/types.ts";
import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import { digest } from "@allmaps/static-render/cache";
import { createSourceContext } from "@allmaps/static-render/context";
import { loadLayer, type LoadedLayer } from "./layers.ts";
import { sceneStyles } from "./styles.ts";
import type { RenderPlan, RenderJob } from "@allmaps/static-render/types";
import type { ContentSnapshot } from "../content/index.ts";
import { createContentAssets } from "../content/assets.ts";
import { within } from "../content/index.ts";
import { getStartScreenText } from "../model/project.ts";
export async function prepareThumbnails(content: ContentSnapshot, options: {
  assetRoot: string;
  cacheRoot: string;
  annotationsRoot: string;
  offline: boolean;
  refresh: boolean;
  publicUrl?: string;
}) {
  const { assets } = createContentAssets(content);
  const slidesConfig = content.config.slidesConfig;
  const {
    epoch,
    sources,
    annotations: annotationCache,
  } = await createSourceContext({ ...options, assets });
  const plan: RenderPlan = {
    version: 2,
    refresh: options.refresh,
    epoch,
    publicUrl: options.publicUrl,
    assets,
    layers: {},
    jobs: [],
    resources: {},
  };
  const manifest = emptyThumbnails();
  const layers = new Map<string, LoadedLayer>();
  const project = content.project;
  const textOverlay = slidesConfig.socialImage?.textOverlay === true;
  if (textOverlay) {
    const font = slidesConfig.socialImage?.font;
    const fontPath = font
      ? font.path && path.resolve(options.assetRoot, font.path)
      : path.join(content.config.appDir, "static/fonts/LeagueSpartan-VariableFont_wght.ttf");
    if (font?.path && fontPath) {
      within(options.assetRoot, fontPath);
      within(await realpath(options.assetRoot), await realpath(fontPath));
    }
    plan.fonts = { title: {
      family: font?.family ?? "League Spartan",
      ...(fontPath ? { base64: (await readFile(fontPath)).toString("base64") } : {}),
    } };
  }
  const startText = getStartScreenText(project);

  const getLayer = async (props: WarpedMapProps, theme: ThemeMode) => {
    const key = layerPreviewKey(props, theme);
    let layer = layers.get(key);
    if (!layer) {
      layer = await loadLayer(props, annotationCache, sources, theme);
      layers.set(key, layer);
      plan.layers[key] = {
        effects: layer.effects,
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
      mapStyleFiles: content.styles,
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
      (chapter.warpedMaps ?? []).toReversed().map((props) => getLayer(props, theme)),
    );
    return addJob({
      layers: selected.map((layer) => layerPreviewKey(layer.props, theme)),
      camera,
      size,
      styles,
      format: social ? "jpg" : "webp",
      ...(social && textOverlay ? { textOverlay: {
        title: project.title,
        subtitle: slideshow.id === project.main ? startText.description : slideshow.title,
        font: "title",
        ...(slidesConfig.socialImage?.textSize !== undefined
          ? { textSize: slidesConfig.socialImage.textSize } : {}),
      } } : {}),
    });
  };

  try {
    for (const slideshow of project.slideshows) {
      console.log(
        `[thumbnails] ${slideshow.id}: ${slideshow.chapters.length} slides`,
      );
      const size: [number, number] = [540, 400];
      const cameras: Record<ThemeMode, Camera> = {
        light: { center: [0, 0], zoom: 14, bearing: 0 },
        dark: { center: [0, 0], zoom: 14, bearing: 0 },
      };
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
        // User-layer changes advance once per chapter, independently of theme.
        overlays = applyUserLayerChanges(overlays, chapter.layers);
        const previews = {} as Record<ThemeMode, Thumbnail>;
        for (const theme of ["light", "dark"] as const) {
          const selected = await Promise.all(
            (chapter.warpedMaps ?? []).map((props) => getLayer(props, theme)),
          );
          const mapsFor = (props: WarpedMapProps) =>
            layers.get(layerPreviewKey(props, theme))?.maps ?? [];
          for (const layer of selected) {
            const key = layerPreviewKey(layer.props, theme);
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
          const previousCamera = cameras[theme];
          const camera = resolveChapterCamera(chapter, mapsFor, size, 20, previousCamera);
          cameras[theme] = camera;
          if (!("slug" in chapter)) continue;
          previews[theme] = await renderScene(
            slideshow,
            chapter,
            theme,
            camera,
            size,
            overlays,
          );
          if (theme === "light" && chapter === slideshow.chapters[0]) {
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
        if ("slug" in chapter)
          manifest.slides[slidePreviewKey(slideshow.id, String(chapter.slug))] = previews;
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
