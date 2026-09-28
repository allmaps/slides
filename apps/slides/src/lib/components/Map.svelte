<script lang="ts">
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import { dev } from "$app/environment";
  import { onMount, untrack } from "svelte";
  import { Minus, Plus } from "@lucide/svelte";

  import * as maplibregl from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";
  import mapWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
  import type {
    CenterZoomBearing,
    EaseToOptions,
    FlyToOptions,
    GeoJSONSource,
    LayerSpecification,
    LngLatBoundsLike,
    PaddingOptions,
    SourceSpecification,
  } from "maplibre-gl";

  import {
    WarpedMapLayer,
    type MapLibreWarpedMapLayerOptions,
  } from "@allmaps/maplibre";
  import {
    getAnnotationsFromChapters,
    getUniqueAnnotations,
    hidesBasemap,
    getWarpedMapOptions,
  } from "$lib/shared/map/annotations";
  import {
    resolveChapterCamera,
    getCameraLayoutOptions,
    type CameraLayoutOptions,
  } from "$lib/shared/map/camera";
  import { constrainSlideshowCamera } from "$lib/shared/map/constraints";
  import { withBaseUrl } from "$lib/shared/paths";
  import { createFauxGeoreferencedMap } from "$lib/shared/map/image";
  import { prepareUserLayers, getUserLayerChange } from "$lib/shared/map/layers";
  import { slidesConfig } from "$lib/shared/app-config";
  import {
    getBasemapLayerVisibility as resolveLayerVisibility,
    getLayerWithVisibility as resolveLayerWithVisibility,
    FOREGROUND_LAYER_ID,
    createEmptyMapStyle,
    getBasemapStyleKey,
    getEffectiveBasemapLayerState,
    getEffectiveBasemapStyleConfig,
    getEffectiveBasemapTheme,
    resolveBasemapStyle,
    type EffectiveBasemapLayerState,
    type ResolvedBasemapStyle,
  } from "$lib/shared/basemap";
  import {
    DEFAULT_PADDING,
    DEFAULT_DURATION,
    DEFAULT_COLORS,
    DEFAULT_OVERVIEW_TILES_RESOLUTION,
    DEFAULT_WARPED_MAP_OPTIONS,
  } from "$lib/shared/settings";

  import type {
    MapConfig,
    MapChapterProps,
    ThemeMode,
    WarpedMapProps,
  } from "$lib/shared/types";

  type SpriteProps = NonNullable<MapChapterProps["sprite"]>;
  type Props = {
    annotationUrls?: Record<string, string>;
    chapters: MapChapterProps[];
    index: number;
    isDarkMode?: boolean;
    duration?: number;
    locale?: string;
    sources?: {
      [key: string]: SourceSpecification;
    };
    layers?: LayerSpecification[] | LayerSpecification;
    slideshowMapConfig?: MapConfig;
    highlight?: string;
    hiddenWarpedMapUrls?: string[];
    focusedWarpedMapUrl?: string;
    showLabels?: boolean;
    anticipate?: boolean;
    layoutRevision?: number;
    resetSignal?: number;
    padding?: number | PaddingOptions;
    controlsVisible?: boolean;
    onBasemapAttribution?: (attributions: string[]) => void;
    debug?: boolean;
  };

  let {
    chapters,
    annotationUrls = {},
    index,
    isDarkMode,
    duration,
    locale,
    layers,
    sources,
    slideshowMapConfig,
    highlight,
    hiddenWarpedMapUrls = [],
    focusedWarpedMapUrl,
    showLabels,
    anticipate,
    layoutRevision = 0,
    resetSignal = 0,
    padding,
    controlsVisible = true,
    onBasemapAttribution,
    debug = dev,
  }: Props = $props();

  let start = true;

  let currentChapter = $derived(chapters[index] ?? chapters[0]);
  let currentLocation = $derived(
    currentChapter?.location ? currentChapter.location : {},
  );
  let currentWarpedMaps = $derived(currentChapter?.warpedMaps);
  let currentLayers = $derived(currentChapter?.layers);
  let currentImageSlide = $derived(
    currentWarpedMaps?.some((warpedMaps) => warpedMaps.type === "Image") ||
      false,
  );
  const focusedMapUrl = $derived(currentWarpedMaps?.some(({ url }) => url === focusedWarpedMapUrl)
    ? focusedWarpedMapUrl : undefined);
  let currentHideBasemap = $derived(!!focusedMapUrl || hidesBasemap(currentChapter ?? {}));
  let currentPadding = $derived.by(() => {
    if (typeof padding === "number" || padding === undefined) {
      return padding ?? DEFAULT_PADDING;
    }

    return {
      top: padding.top ?? DEFAULT_PADDING,
      right: padding.right ?? DEFAULT_PADDING,
      bottom: padding.bottom ?? DEFAULT_PADDING,
      left: padding.left ?? DEFAULT_PADDING,
    };
  });

  let sprite = $derived(currentChapter?.sprite);
  const theme = $derived((isDarkMode ? "dark" : "light") as ThemeMode);
  const currentChapterMapConfig = $derived(currentChapter?.map);
  const basemapTheme = $derived(
    getEffectiveBasemapTheme(
      theme,
      slidesConfig.map,
      slideshowMapConfig,
      currentChapterMapConfig,
    ),
  );
  const showLabelsMapConfig = $derived(
    showLabels === undefined
      ? undefined
      : ({
          labels: {
            visible: showLabels,
          },
        } satisfies MapConfig),
  );
  const basemapStyleConfig = $derived(
    getEffectiveBasemapStyleConfig({
      theme: basemapTheme,
      locale,
      appMap: slidesConfig.map,
      appProtomaps: slidesConfig.protomaps,
      slideshowMap: slideshowMapConfig,
      chapterMap: currentChapterMapConfig,
    }),
  );
  const basemapStyleKey = $derived(
    getBasemapStyleKey({
      theme: basemapTheme,
      config: basemapStyleConfig,
    }),
  );
  const basemapLayerState = $derived(
    getEffectiveBasemapLayerState(
      slidesConfig.map,
      slideshowMapConfig,
      currentChapterMapConfig,
      showLabelsMapConfig,
    ),
  );

  let map: maplibregl.Map;
  let container: HTMLElement;
  let mapLoaded = $state(false);
  let currentBearing = $state(0);
  let currentSlideResourcesRevision = $state(0);
  let loadedAnnotationsRevision = $state(0);
  let mapIdsByAnnotationUrl: Map<string, string[]> = new Map();
  let annotationLoadPromisesByUrl: Map<string, Promise<void>> = new Map();
  let spriteLoadPromisesByKey: Map<string, Promise<void>> = new Map();
  let spriteKeysByMapId: Map<string, Set<string>> = new Map();
  let appliedMapOrder = "";
  let imagesAdded: Set<string> = new Set();
  let loadedBasemapStyle: ResolvedBasemapStyle | undefined;
  let loadedBasemapStyleKey = $state<string>();
  let basemapLoadSequence = 0;
  let basemapStyleSwapInProgress = false;
  let initialForegroundOpacityApplied = false;
  let foregroundOpacity = 1;
  let pmtilesProtocolLoaded = false;
  let destroyed = false;

  const SHOW_DEBUG_BOUNDS = false
  const DEBUG_BOUNDS_SOURCE_ID = "slides-debug-bounds";
  const DEBUG_BOUNDS_LAYER_ID = "slides-debug-bounds-layer";
  const BASEMAP_STYLE_FADE_DURATION = 450;
  // Disable opacity/visibility fades while investigating visibility flicker.
  const ANIMATE_WARPED_MAP_OPACITY = false;

  let warpedMapLayerOptions: Partial<MapLibreWarpedMapLayerOptions>;
  let warpedMapLayer: WarpedMapLayer;

  const areAnnotationsLoaded = (annotations: WarpedMapProps[]) =>
    annotations.every(({ url }) => mapIdsByAnnotationUrl.has(url));

  const getMapIdsForAnnotationUrl = (url: string) =>
    mapIdsByAnnotationUrl.get(url) ?? [];

  const getMapIdsForAnnotations = (annotations: WarpedMapProps[]) =>
    annotations.flatMap(({ url }) => getMapIdsForAnnotationUrl(url));

  const rememberMapIdsForAnnotation = (url: string, ids: string[]) => {
    mapIdsByAnnotationUrl.set(url, ids);
    loadedAnnotationsRevision += 1;
  };

  const getEmptyFeatureCollection = () => ({
    type: "FeatureCollection" as const,
    features: [],
  });

  const getBoundsFeatureCollection = (bounds: LngLatBoundsLike) => {
    const convertedBounds = maplibregl.LngLatBounds.convert(bounds);
    const west = convertedBounds.getWest();
    const south = convertedBounds.getSouth();
    const east = convertedBounds.getEast();
    const north = convertedBounds.getNorth();

    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [west, south],
                [east, south],
                [east, north],
                [west, north],
                [west, south],
              ],
            ],
          },
        },
      ],
    };
  };

  const setDebugBounds = (bounds?: LngLatBoundsLike) => {
    if (!debug || !mapLoaded) return;

    const source = map.getSource(DEBUG_BOUNDS_SOURCE_ID) as
      | GeoJSONSource
      | undefined;

    source?.setData(
      bounds ? getBoundsFeatureCollection(bounds) : getEmptyFeatureCollection(),
    );
  };

  const normalizeColor = (color: string | undefined) =>
    color?.replace(/\s+/g, "").toLowerCase();

  const shouldFadeBasemapStyleSwap = (
    previousStyle: ResolvedBasemapStyle | undefined,
    nextStyle: ResolvedBasemapStyle,
  ) =>
    !!previousStyle &&
    !currentHideBasemap &&
    normalizeColor(previousStyle.foregroundColor) !==
      normalizeColor(nextStyle.foregroundColor);

  const wait = (milliseconds: number) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  const waitForNextPaint = () =>
    new Promise((resolve) => window.requestAnimationFrame(() => resolve(true)));

  const setForegroundColor = (foregroundColor: string) => {
    if (!map.getLayer(FOREGROUND_LAYER_ID)) return;

    map.setPaintProperty(
      FOREGROUND_LAYER_ID,
      "background-color-transition",
      { duration: 0 },
    );
    map.setPaintProperty(
      FOREGROUND_LAYER_ID,
      "background-color",
      foregroundColor,
    );
  };

  const setForegroundOpacityTransitionDuration = (
    transitionDuration: number,
  ) => {
    if (!map.getLayer(FOREGROUND_LAYER_ID)) return;

    map.setPaintProperty(
      FOREGROUND_LAYER_ID,
      "background-opacity-transition",
      { duration: transitionDuration },
    );
  };

  const setForegroundOpacity = (
    opacity: number,
    transitionDuration?: number,
  ) => {
    if (!map.getLayer(FOREGROUND_LAYER_ID)) return;
    if (foregroundOpacity === opacity) return;

    if (transitionDuration !== undefined) {
      setForegroundOpacityTransitionDuration(transitionDuration);
    }

    map.setPaintProperty(FOREGROUND_LAYER_ID, "background-opacity", opacity);
    foregroundOpacity = opacity;
  };

  const getBasemapLayerVisibility = (
    style: ResolvedBasemapStyle, id: string, label: boolean,
    state: EffectiveBasemapLayerState,
  ) => resolveLayerVisibility(style, id, label, state, currentHideBasemap);
  const getLayerWithVisibility = (
    style: ResolvedBasemapStyle, layer: LayerSpecification, label: boolean,
    state: EffectiveBasemapLayerState,
  ) => resolveLayerWithVisibility(style, layer, label, state, currentHideBasemap);

  const getFirstLayerId = (predicate: (layerId: string) => boolean) =>
    map.getLayersOrder().find(predicate);

  const getFirstOverlayLayerId = () =>
    getFirstLayerId(
      (layerId) =>
        layerId.startsWith("user-") || layerId === DEBUG_BOUNDS_LAYER_ID,
    );

  const moveBasemapLabels = (
    basemapStyle: ResolvedBasemapStyle,
    layerState: EffectiveBasemapLayerState,
  ) => {
    const beforeId =
      layerState.labels.position === "aboveWarpedMaps"
        ? getFirstOverlayLayerId()
        : FOREGROUND_LAYER_ID;

    for (const layerId of basemapStyle.labelLayerIds) {
      if (!map.getLayer(layerId)) continue;
      map.moveLayer(layerId, beforeId);
    }
  };

  const setStyleAssets = (basemapStyle: ResolvedBasemapStyle) => {
    if (basemapStyle.glyphs) {
      map.setGlyphs(basemapStyle.glyphs);
    }

    if (typeof basemapStyle.sprite === "string") {
      map.setSprite(basemapStyle.sprite);
    }
  };

  const removeLoadedBasemapStyle = () => {
    if (!loadedBasemapStyle) return;

    for (const layerId of loadedBasemapStyle.layerIds.toReversed()) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    for (const sourceId of loadedBasemapStyle.sourceIds) {
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    }
  };

  const ensureForegroundLayer = (foregroundColor: string) => {
    if (map.getLayer(FOREGROUND_LAYER_ID)) {
      setForegroundColor(foregroundColor);
      return;
    }

    map.addLayer(
      {
        id: FOREGROUND_LAYER_ID,
        type: "background",
        paint: {
          "background-color": foregroundColor,
          "background-opacity": 1,
        },
      },
      map.getLayer(warpedMapLayer.id) ? warpedMapLayer.id : undefined,
    );
  };

  const addBasemapStyle = async (
    basemapStyle: ResolvedBasemapStyle,
    layerState: EffectiveBasemapLayerState,
  ) => {
    await loadSources(basemapStyle.sources);

    for (const layer of basemapStyle.baseLayers) {
      map.addLayer(
        getLayerWithVisibility(basemapStyle, layer, false, layerState),
        FOREGROUND_LAYER_ID,
      );
    }

    const labelsBeforeId =
      layerState.labels.position === "aboveWarpedMaps"
        ? getFirstOverlayLayerId()
        : FOREGROUND_LAYER_ID;

    for (const layer of basemapStyle.labelLayers) {
      map.addLayer(
        getLayerWithVisibility(basemapStyle, layer, true, layerState),
        labelsBeforeId,
      );
    }
  };

  const applyBasemapLayerState = () => {
    if (!mapLoaded || !loadedBasemapStyle) return;

    moveBasemapLabels(loadedBasemapStyle, basemapLayerState);

    for (const layerId of loadedBasemapStyle.baseLayerIds) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(
        layerId,
        "visibility",
        getBasemapLayerVisibility(
          loadedBasemapStyle,
          layerId,
          false,
          basemapLayerState,
        ),
      );
    }

    for (const layerId of loadedBasemapStyle.labelLayerIds) {
      if (!map.getLayer(layerId)) continue;
      map.setLayoutProperty(
        layerId,
        "visibility",
        getBasemapLayerVisibility(
          loadedBasemapStyle,
          layerId,
          true,
          basemapLayerState,
        ),
      );
    }

    if (!basemapStyleSwapInProgress) {
      const initialOpacityUpdate = !initialForegroundOpacityApplied;

      setForegroundOpacity(
        currentHideBasemap ? 1 : 0,
        initialOpacityUpdate ? 0 : duration || DEFAULT_DURATION,
      );

      if (initialOpacityUpdate) {
        initialForegroundOpacityApplied = true;
      }
    }
  };

  let lastAttribution = "";
  const publishBasemapAttribution = () => {
    if (!loadedBasemapStyle) return;
    const attributions = [...new Set(loadedBasemapStyle.sourceIds.flatMap((id) => {
      const configured = loadedBasemapStyle!.sources[id];
      const attribution = (map.getSource(id)?.attribution ??
        ("attribution" in configured ? configured.attribution : undefined))?.trim();
      return attribution ? [attribution] : [];
    }))];
    const key = JSON.stringify(attributions);
    if (key === lastAttribution) return;
    lastAttribution = key;
    onBasemapAttribution?.(attributions);
  };

  const applyCurrentBasemapStyle = async () => {
    const styleKey = basemapStyleKey;

    if (styleKey === loadedBasemapStyleKey) {
      return;
    }

    const loadSequence = ++basemapLoadSequence;
    basemapStyleSwapInProgress = false;

    if (debug) {
      console.log("Loading basemap style...", basemapStyleConfig);
    }

    const nextBasemapStyle = await resolveBasemapStyle({
      theme: basemapTheme,
      config: basemapStyleConfig,
    });

    if (destroyed || loadSequence !== basemapLoadSequence) return;

    const fadeStyleSwap = shouldFadeBasemapStyleSwap(
      loadedBasemapStyle,
      nextBasemapStyle,
    );

    if (fadeStyleSwap) {
      basemapStyleSwapInProgress = true;
      setForegroundColor(nextBasemapStyle.foregroundColor);
      setForegroundOpacity(1, BASEMAP_STYLE_FADE_DURATION);
      await waitForNextPaint();
      await wait(BASEMAP_STYLE_FADE_DURATION);
    }

    if (destroyed || loadSequence !== basemapLoadSequence) return;

    removeLoadedBasemapStyle();
    setStyleAssets(nextBasemapStyle);
    ensureForegroundLayer(nextBasemapStyle.foregroundColor);
    await addBasemapStyle(nextBasemapStyle, basemapLayerState);

    if (destroyed || loadSequence !== basemapLoadSequence) return;

    loadedBasemapStyle = nextBasemapStyle;
    loadedBasemapStyleKey = styleKey;
    publishBasemapAttribution();

    if (fadeStyleSwap) {
      basemapStyleSwapInProgress = false;
      setForegroundOpacity(
        currentHideBasemap ? 1 : 0,
        BASEMAP_STYLE_FADE_DURATION,
      );
    }
  };

  const getSpriteKey = (sprite: SpriteProps) =>
    `${sprite.json}\0${sprite.image}\0${sprite.dimensions.join("x")}`;

  const hasSpriteForMapIds = (
    sprite: SpriteProps | undefined,
    mapIds: string[],
  ) => {
    if (!sprite || !mapIds.length) return true;

    const spriteKey = getSpriteKey(sprite);

    return mapIds.every((mapId) =>
      spriteKeysByMapId.get(mapId)?.has(spriteKey),
    );
  };

  const currentSlideResourcesReady = () => {
    if (!currentWarpedMaps) return true;
    if (!areAnnotationsLoaded(currentWarpedMaps)) return false;

    return hasSpriteForMapIds(sprite, getMapIdsForAnnotations(currentWarpedMaps));
  };

  function getFlyToOptions(
    camera: CenterZoomBearing | undefined,
    cameraLayoutOptions: CameraLayoutOptions,
    forceOffset = false,
    useCurrentLocation = true,
  ) {
    const flyToOptions: FlyToOptions = {
      ...(camera ?? {}),
      ...(useCurrentLocation ? currentLocation : {}),
    };

    if (
      cameraLayoutOptions.offset &&
      (forceOffset ||
        (useCurrentLocation && currentLocation.center) ||
        (camera === undefined &&
          useCurrentLocation &&
          currentLocation.bearing !== undefined))
    ) {
      flyToOptions.offset = cameraLayoutOptions.offset;
    }

    const initialCameraUpdate = start;
    if (currentImageSlide || initialCameraUpdate) {
      flyToOptions.duration = 0;
    } else if (
      (!useCurrentLocation || !currentLocation.duration) &&
      duration
    ) {
      flyToOptions.duration = duration;
    }

    return { flyToOptions, initialCameraUpdate };
  }

  function flyToCamera(
    camera: CenterZoomBearing | undefined,
    cameraLayoutOptions: CameraLayoutOptions,
    forceOffset = false,
    useCurrentLocation = true,
  ) {
    const { flyToOptions, initialCameraUpdate } = getFlyToOptions(
      camera,
      cameraLayoutOptions,
      forceOffset,
      useCurrentLocation,
    );

    map.flyTo(flyToOptions);

    if (initialCameraUpdate) {
      start = false;
    }
  }

  function markSpriteLoadedForMapIds(sprite: SpriteProps, mapIds: string[]) {
    const spriteKey = getSpriteKey(sprite);

    mapIds.forEach((mapId) => {
      const spriteKeys = spriteKeysByMapId.get(mapId) ?? new Set<string>();
      spriteKeys.add(spriteKey);
      spriteKeysByMapId.set(mapId, spriteKeys);
    });
  }

  async function loadAnnotation(annotation: WarpedMapProps) {
    const { url } = annotation;

    if (mapIdsByAnnotationUrl.has(url)) return;

    const existingPromise = annotationLoadPromisesByUrl.get(url);
    if (existingPromise) return existingPromise;

    const promise = (async () => {
      try {
        if (debug) {
          console.log("Loading warped map...", annotation);
        }

        if (annotation.type === "Image") {
          // Create a 'fake' annotation for the image, in order to add it to the map
          const georeferencedMap = await createFauxGeoreferencedMap(url, {
            region: annotation.region,
            wiggle: annotation.wiggle,
          });

          if (destroyed) return;

          const options = {
            ...getWarpedMapOptions(annotation, theme),
            visible: false,
          };
          const id = warpedMapLayer.addGeoreferencedMap(georeferencedMap, options);
          rememberMapIdsForAnnotation(url, [id]);
        } else {
          const snapshotUrl = annotationUrls[url];
          const georeferenceAnnotation = await fetch(snapshotUrl ? withBaseUrl(snapshotUrl) : url).then((response) =>
            response.json(),
          );

          if (destroyed) return;

          const options = {
            ...getWarpedMapOptions(annotation, theme),
            visible: false,
          };
          const results = warpedMapLayer.addGeoreferenceAnnotation(georeferenceAnnotation, options);

          const mapIds = results.flatMap((result) => result.ok ? [result.mapId] : []);
          const errors = results.flatMap((result) => result.ok ? [] : [result.error]);
          if (errors.length) {
            console.error("Failed to add georeferenced map for", url, errors);
          }
          rememberMapIdsForAnnotation(url, mapIds);
        }
      } catch (error) {
        if (!destroyed) {
          console.error("Failed to load georeferenced map for", url, error);
          rememberMapIdsForAnnotation(url, []);
        }
      } finally {
        annotationLoadPromisesByUrl.delete(url);
      }
    })();

    annotationLoadPromisesByUrl.set(url, promise);

    return promise;
  }

  async function loadAnnotations(annotations: WarpedMapProps[]) {
    const uniqueAnnotations = getUniqueAnnotations(annotations).filter(
      ({ url }) => !mapIdsByAnnotationUrl.has(url),
    );

    if (debug && uniqueAnnotations.length) {
      console.log("Loading warped maps...", {
        chapterIndex: index,
        count: uniqueAnnotations.length,
        annotations: uniqueAnnotations,
      });
    }

    await Promise.all(uniqueAnnotations.map(loadAnnotation));
  }

  async function loadSpriteForMapIds(
    sprite: SpriteProps | undefined,
    mapIds: string[],
  ) {
    if (!sprite || !mapIds.length || hasSpriteForMapIds(sprite, mapIds)) return;

    const spriteKey = getSpriteKey(sprite);
    const existingPromise = spriteLoadPromisesByKey.get(spriteKey);
    if (existingPromise) {
      await existingPromise;
      if (hasSpriteForMapIds(sprite, mapIds)) return;
    }

    const promise = (async () => {
      try {
        if (debug) {
          console.log("Loading warped map sprites...", sprite);
        }

        const spriteJson = await fetch(`/sprites/${sprite.json}`).then((resp) =>
          resp.json(),
        );

        if (destroyed) return;

        await warpedMapLayer.addSprites(
          spriteJson,
          window.location.origin + `/sprites/${sprite.image}`,
          sprite.dimensions,
        );

        if (destroyed) return;

        markSpriteLoadedForMapIds(sprite, warpedMapLayer.getMapIds());
      } catch (error) {
        if (!destroyed) {
          console.error("Failed to load warped map sprites for", sprite, error);
          markSpriteLoadedForMapIds(sprite, mapIds);
        }
      } finally {
        spriteLoadPromisesByKey.delete(spriteKey);
      }
    })();

    spriteLoadPromisesByKey.set(spriteKey, promise);

    return promise;
  }

  function applyWarpedMapState() {
    currentSlideResourcesRevision;
    loadedAnnotationsRevision;
    if (!mapLoaded || !currentSlideResourcesReady()) return;

    const hidden = new Set(hiddenWarpedMapUrls);
    // Anticipation belongs to the whole active slideshow, not just its visible
    // slide. Maps retained from another slideshow should stop preloading.
    const anticipationByMapId = new Map<string, boolean>();
    for (const annotation of getAnnotationsFromChapters(chapters)) {
      const anticipateVisibility = getWarpedMapOptions(annotation, theme).anticipateVisibility
        ?? anticipate ?? false;
      for (const id of getMapIdsForAnnotationUrl(annotation.url)) {
        anticipationByMapId.set(id, anticipateVisibility);
      }
    }
    const optionsByMapId = new Map<string, Partial<MapLibreWarpedMapLayerOptions>>();
    for (const annotation of (currentWarpedMaps ?? []).toReversed()) {
      const fullMap = annotation.url === focusedMapUrl;
      // Full-map mode uses defaults instead of the authored theme overrides.
      const options = fullMap
        ? {
            ...DEFAULT_WARPED_MAP_OPTIONS,
            applyMask: false,
            transformationType: "helmert" as const,
          }
        : getWarpedMapOptions(annotation, theme);
      const visible = !hidden.has(annotation.url);
      for (const id of getMapIdsForAnnotationUrl(annotation.url)) {
        optionsByMapId.set(id, {
          ...options,
          ...(!fullMap && annotation.url === highlight ? { renderMask: true } : {}),
          visible,
          anticipateVisibility: options.anticipateVisibility ?? anticipate ?? false,
        });
      }
    }
    // Visibility, theme, focus and highlighting share a single options update.
    // Reordering is only necessary when the actual stack of maps changes.
    const ids = [...optionsByMapId.keys()];
    const order = JSON.stringify(ids);
    untrack(() => {
      if (order !== appliedMapOrder) {
        if (ids.length) warpedMapLayer.bringMapsToFront(ids);
        appliedMapOrder = order;
      }
      warpedMapLayer.setMapsOptions(
        (id) => {
          const options = optionsByMapId.get(id);
          if (!options) return {
            visible: false,
            anticipateVisibility: anticipationByMapId.get(id) ?? false,
          };

          // Allmaps merges options, so explicitly clear obsolete overrides in
          // the same update. Allmaps handles comparing the resulting values.
          return {
            ...Object.fromEntries(
              Object.keys(warpedMapLayer.getMapMapOptions(id) ?? {})
                .map((key) => [key, undefined]),
            ),
            ...options,
          };
        },
        ANIMATE_WARPED_MAP_OPACITY ? undefined : {
          // Keep other transitions, including in batches that also change visibility.
          animatedOptions: warpedMapLayer.renderer?.warpedMapList.options.animatedOptions
            .filter((option) => option !== "visible" && option !== "opacity"),
        },
      );
    });
  }

  function setChapterCamera() {
    layoutRevision;
    resetSignal;
    currentSlideResourcesRevision;
    if (!mapLoaded || !currentSlideResourcesReady()) return;
    const cameraLayoutOptions = getCameraLayoutOptions(currentPadding);
    if (focusedMapUrl) {
      const ids = getMapIdsForAnnotationUrl(focusedMapUrl);
      if (!ids.length) return;
      try {
        const camera = warpedMapLayer.getMapsCenterZoomBearing(ids, {
          applyMask: false,
          bearingMapIds: [ids[0]],
          ...cameraLayoutOptions,
        });
        flyToCamera(camera, cameraLayoutOptions, true, false);
      } catch (error) {
        console.error("Failed to fit full map", focusedMapUrl, error);
      }
    } else if (currentWarpedMaps) {
      const camera = resolveChapterCamera(
        currentChapter ?? {},
        (annotation) => getMapIdsForAnnotationUrl(annotation.url)
          .flatMap((id) => {
            const warped = warpedMapLayer.getWarpedMap(id);
            return warped ? [warped] : [];
          }),
        [container.clientWidth, container.clientHeight],
        cameraLayoutOptions.padding,
        {
          center: [map.getCenter().lng, map.getCenter().lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
        },
      );
      setDebugBounds(warpedMapLayer.getMapsBounds(getMapIdsForAnnotations(currentWarpedMaps)));
      flyToCamera(camera, cameraLayoutOptions, true);
    } else {
      setDebugBounds();
    }
  }

  const easeToWithLayoutOffset = (options: EaseToOptions) => {
    const cameraLayoutOptions = getCameraLayoutOptions(currentPadding);

    map.easeTo({
      ...options,
      ...(cameraLayoutOptions.offset
        ? { offset: cameraLayoutOptions.offset }
        : {}),
    });
  };

  function toggleVisibility(event: KeyboardEvent) {
    if (event.repeat) return;
    if (mapLoaded && event.code === "Backquote") {
      const opacity = warpedMapLayer.getOpacity();
      warpedMapLayer.setLayerOptions(
        { opacity: opacity === 0 ? 1 : 0 },
        { animate: ANIMATE_WARPED_MAP_OPACITY },
      );
    }
  }

  const resetNorth = () => {
    if (!mapLoaded) return;

    easeToWithLayoutOffset({ bearing: 0, duration: 300 });
  };

  const zoomIn = () => {
    if (!mapLoaded) return;

    easeToWithLayoutOffset({ zoom: map.getZoom() + 1, duration: 300 });
  };

  const zoomOut = () => {
    if (!mapLoaded) return;

    easeToWithLayoutOffset({ zoom: map.getZoom() - 1, duration: 300 });
  };

  function setLocation() {
    layoutRevision;
    resetSignal;
    const cameraLayoutOptions = getCameraLayoutOptions(currentPadding);

    if (mapLoaded && currentLocation && !currentWarpedMaps) {
      if (debug) {
        console.log("Animating to new location...", currentLocation);
      }
      flyToCamera(undefined, cameraLayoutOptions);
    }
  }

  async function loadPmtilesProtocol() {
    const { Protocol } = await import("pmtiles");
    const protocol = new Protocol();
    maplibregl.addProtocol("pmtiles", protocol.tile);
    pmtilesProtocolLoaded = true;
  }

  function loadSources(sources: { [key: string]: SourceSpecification }) {
    if (debug) {
      console.log("Loading sources...", sources);
    }
    return Promise.all(
      Object.entries(sources).map(async ([id, source]) => {
        if (source.type === "vector" && source.url?.startsWith("pmtiles://")) {
          if (!pmtilesProtocolLoaded) {
            await loadPmtilesProtocol();
          }
        }
        map.addSource(id, source);
      }),
    );
  }

  function loadLayers(layers: LayerSpecification | LayerSpecification[]) {
    if (debug) {
      console.log("Loading layers...", layers);
    }
    const layerList = Array.isArray(layers) ? layers : [layers];

    prepareUserLayers(layerList)
      .forEach((layer) => {
        const vectorTypes = ["symbol", "circle", "line", "raster", "fill"];
        const moveToFront = vectorTypes.includes(layer.type);
        map.addLayer(layer, moveToFront ? undefined : "warped-map-layer");
      });
  }

  function setUserLayerState() {
    if (!mapLoaded || !layers) return;
    const layerList = Array.isArray(layers) ? layers : [layers];

    for (const layer of prepareUserLayers(layerList)) {
      if (!map.getLayer(layer.id)) continue;
      const change = currentLayers?.find((change) => `user-${change.layer}` === layer.id);
      const source = "source" in layer ? sources?.[layer.source] : undefined;
      const visibility = focusedMapUrl && source?.type === "geojson"
        ? "none"
        : change?.visibility ?? layer.layout?.visibility ?? "visible";
      // Full-map mode temporarily hides content overlays, including layers
      // with no per-slide overrides. Restore the slide's visibility on exit.
      map.setLayoutProperty(layer.id, "visibility", visibility);

      if (!change) continue;
      const { paint, duration } = getUserLayerChange(change, layer.type);
      for (const [property, value] of Object.entries(paint)) {
        const options = duration ? { duration } : {};
        if (duration) map.setPaintProperty(layer.id, `${property}-transition` as keyof maplibregl.AllPaintProperties, options);
        map.setPaintProperty(layer.id, property as keyof maplibregl.AllPaintProperties, value);
      }
    }
  }

  $effect(() => {
    if (!mapLoaded) return;

    const currentAnnotations = currentWarpedMaps ?? [];
    const currentSprite = sprite;
    const currentChapters = chapters;
    const currentResourcesReady =
      areAnnotationsLoaded(currentAnnotations) &&
      hasSpriteForMapIds(
        currentSprite,
        getMapIdsForAnnotations(currentAnnotations),
      );
    let cancelled = false;

    void (async () => {
      if (!currentResourcesReady) {
        await loadAnnotations(currentAnnotations);
        if (cancelled) return;

        await loadSpriteForMapIds(
          currentSprite,
          getMapIdsForAnnotations(currentAnnotations),
        );
        if (cancelled) return;

        currentSlideResourcesRevision += 1;
      }

      const currentAnnotationUrls = new Set(
        currentAnnotations.map(({ url }) => url),
      );
      const backgroundAnnotations = getAnnotationsFromChapters(
        currentChapters,
      ).filter(({ url }) => !currentAnnotationUrls.has(url));

      void loadAnnotations(backgroundAnnotations);
    })();

    return () => {
      cancelled = true;
    };
  });
  $effect(applyWarpedMapState);
  $effect(setChapterCamera);
  $effect(setUserLayerState);
  $effect(() => {
    if (!mapLoaded) return;
    basemapStyleKey;
    // Loading a style must not subscribe this effect to temporary layer state.
    untrack(() => { void applyCurrentBasemapStyle(); });
  });
  $effect(() => {
    // Keep the hide flag tracked while a new theme's style is loading.
    currentHideBasemap;
    basemapLayerState;
    if (!mapLoaded || basemapStyleKey !== loadedBasemapStyleKey) return;
    applyBasemapLayerState();
  });
  $effect(setLocation);

  onMount(() => {
    // Read initialization options when the client-side layer is created.
    warpedMapLayerOptions = {
      visible: false,
      anticipateVisibility: anticipate ?? false,
      overviewTilesSelection: "lowest",
      overviewTilesMaxResolution: DEFAULT_OVERVIEW_TILES_RESOLUTION,
    };
    warpedMapLayer = new WarpedMapLayer(warpedMapLayerOptions);
    maplibregl.setWorkerUrl(mapWorkerUrl);
    map = new maplibregl.Map({
      container,
      locale: { "Map.Title": t("map") },
      style: createEmptyMapStyle(basemapTheme),
      maxPitch: 0,
      attributionControl: false,
      center: [0, 0],
      zoom: 14,
      bearingSnap: 0,
      keyboard: false,
      transformConstrain: constrainSlideshowCamera,
      transformRequest: dev ? (url, resourceType) => {
        if (resourceType === "Source") {
          const sourceUrl = new URL(url, window.location.href);
          if (
            sourceUrl.origin === window.location.origin &&
            sourceUrl.pathname.startsWith(withBaseUrl("/api/"))
          ) {
            // Worker requests must also bypass responses cached before dev
            // asset routes started sending no-store headers.
            return { url, cache: "no-store" };
          }
        }
        return { url };
      } : undefined,
    });
    const updateBearing = () => {
      currentBearing = map.getBearing();
    };

    map.on("move", updateBearing);
    // TileJSON may supply attribution after its style source was installed.
    map.on("sourcedata", (event) => {
      if (event.sourceDataType === "metadata" && loadedBasemapStyle?.sourceIds.includes(event.sourceId)) {
        publishBasemapAttribution();
      }
    });

    map.setMissingStyleImageResolver(async (id) => {
      if (!imagesAdded.has(id)) {
        imagesAdded.add(id);
        const image = await map.loadImage(id);
        map.addImage(id, image.data);
      }
    });

    map.on("load", async () => {
      map.addLayer(warpedMapLayer);
      await applyCurrentBasemapStyle();

      if (sources && layers) {
        await loadSources(sources);
        loadLayers(layers);
      }

      if (debug && SHOW_DEBUG_BOUNDS) {
        // Debug layer to show bounds
        map.addSource(DEBUG_BOUNDS_SOURCE_ID, {
          type: "geojson",
          data: getEmptyFeatureCollection(),
        });
        map.addLayer({
          id: DEBUG_BOUNDS_LAYER_ID,
          type: "line",
          source: DEBUG_BOUNDS_SOURCE_ID,
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": DEFAULT_COLORS.blue.stroke,
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });
      }

      mapLoaded = true;
      updateBearing();
    });

    return () => {
      destroyed = true;
      if (mapLoaded) {
        warpedMapLayer.clear();
      }
      map.remove();
    };
  });
</script>

<svelte:window on:keydown={toggleVisibility} on:keyup={toggleVisibility} />

<div class="relative h-full min-h-0 w-full min-w-0">
  <div class="h-full min-h-0 w-full min-w-0" bind:this={container}></div>

  <div
    class="map-controls pointer-events-none absolute z-10 flex flex-col md:flex-row"
    class:map-controls--hidden={!controlsVisible}
    aria-hidden={!controlsVisible}
    inert={!controlsVisible}
  >
    <button
      type="button"
      class="pointer-events-auto inline-flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-lg bg-[var(--app-map-control-bg)] text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md"
      aria-label={t("zoomIn")}
      title={t("zoomIn")}
      onclick={zoomIn}
    >
      <Plus size={24} aria-hidden="true" />
    </button>

    <button
      type="button"
      class="pointer-events-auto inline-flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-lg bg-[var(--app-map-control-bg)] text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md"
      aria-label={t("zoomOut")}
      title={t("zoomOut")}
      onclick={zoomOut}
    >
      <Minus size={24} aria-hidden="true" />
    </button>

    <button
      type="button"
      class="pointer-events-auto inline-flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-lg bg-[var(--app-map-control-bg)] text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md"
      aria-label={t("resetNorth")}
      title={t("resetNorth")}
      onclick={resetNorth}
    >
      <svg
        class="h-9 w-9"
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={`transform: rotate(${-currentBearing}deg)`}
      >
        <path d="M12 2.5 8.75 12h6.5L12 2.5Z" fill="white" />
        <path d="M12 21.5 8.75 12h6.5L12 21.5Z" fill="var(--app-interface-grey)" />
      </svg>
    </button>
  </div>
</div>

<style>
  .map-controls {
    gap: var(--app-control-gap);
    top: var(--app-inset-top);
    right: var(--app-inset-right);
    opacity: 1;
    transform: translateY(0);
    transition:
      opacity 350ms ease,
      transform 500ms ease;
  }

  .map-controls--hidden {
    opacity: 0;
    transform: translateY(calc(-100% - 1.25rem));
  }

  @media (min-width: 768px) {
    .map-controls {
      top: auto;
      right: auto;
      bottom: var(--app-inset-bottom);
      left: var(--app-inset-left);
    }
    .map-controls--hidden {
      transform: translateY(calc(100% + 1.25rem));
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .map-controls {
      transition: none;
    }
  }
</style>
