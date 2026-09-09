<script lang="ts">
  import { dev } from "$app/environment";
  import { onMount } from "svelte";
  import { Minus, Plus } from "@lucide/svelte";

  import maplibregl from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";
  import type {
    CenterZoomBearing,
    CameraForBoundsOptions,
    EaseToOptions,
    FlyToOptions,
    GeoJSONSource,
    LayerSpecification,
    LngLatBoundsLike,
    PaddingOptions,
    PointLike,
    SourceSpecification,
  } from "maplibre-gl";

  import {
    WarpedMapLayer,
    type MapLibreWarpedMapLayerOptions,
  } from "@allmaps/maplibre";
  import { createFauxGeoreferencedMap } from "$lib/shared/utils";
  import { slidesConfig } from "$lib/shared/app-config";
  import {
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
    DEFAULT_WARPED_MAP_OPTIONS,
    DEFAULT_DURATION,
    DEFAULT_COLORS,
    DEFAULT_OVERVIEW_TILES_RESOLUTION,
    LAYER_TYPES,
  } from "$lib/shared/settings";

  import type {
    MapConfig,
    MapChapterProps,
    ThemeMode,
    WarpedMapProps,
  } from "$lib/shared/types";

  type SpriteProps = NonNullable<MapChapterProps["sprite"]>;
  type CameraLayoutOptions = {
    padding: number | PaddingOptions;
    offset?: PointLike;
  };

  type Props = {
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
    zoomToWarpedMapUrl?: string;
    zoomToWarpedMapSignal?: number;
    showLabels?: boolean;
    anticipate?: boolean;
    layoutRevision?: number;
    resetSignal?: number;
    padding?: number | PaddingOptions;
    debug?: boolean;
  };

  let {
    chapters,
    index,
    isDarkMode,
    duration,
    locale,
    layers,
    sources,
    slideshowMapConfig,
    highlight,
    hiddenWarpedMapUrls = [],
    zoomToWarpedMapUrl,
    zoomToWarpedMapSignal = 0,
    showLabels,
    anticipate,
    layoutRevision = 0,
    resetSignal = 0,
    padding,
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
  let currentHideBasemap = $derived(
    currentImageSlide || currentChapter?.hideBasemap,
  );
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
  let mapIdsByAnnotationUrl: Map<string, string[]> = new Map();
  let annotationUrlByMapId: Map<string, string> = new Map();
  let annotationLoadPromisesByUrl: Map<string, Promise<void>> = new Map();
  let spriteLoadPromisesByKey: Map<string, Promise<void>> = new Map();
  let spriteKeysByMapId: Map<string, Set<string>> = new Map();
  let visibleMaps: string[] = new Array();
  let currentVisibleMaps: string[] = [];
  let appliedWarpedMapStateKey: string | undefined;
  let latestHiddenWarpedMapUrls: string[] = [];
  let imagesAdded: Set<string> = new Set();
  let highlightedMaps: string[] = [];
  let handledZoomToWarpedMapSignal = 0;
  let loadedBasemapStyle: ResolvedBasemapStyle | undefined;
  let loadedBasemapStyleKey: string | undefined;
  let basemapLoadSequence = 0;
  let basemapStyleSwapInProgress = false;
  let initialForegroundOpacityApplied = false;
  let foregroundOpacity = 1;
  let pmtilesProtocolLoaded = false;
  let destroyed = false;

  const MAPLIBRE_TILE_SIZE = 512;
  const WEB_MERCATOR_WORLD_WIDTH = 40075016.68557849;
  const DEBUG_BOUNDS_SOURCE_ID = "slides-debug-bounds";
  const DEBUG_BOUNDS_LAYER_ID = "slides-debug-bounds-layer";
  const BASEMAP_STYLE_FADE_DURATION = 450;

  const warpedMapLayerOptions: Partial<MapLibreWarpedMapLayerOptions> = {
    visible: false,
    anticipateVisibility: anticipate ? true : false,
    overviewTilesSelection: "lowest",
    overviewTilesMaxResolution: DEFAULT_OVERVIEW_TILES_RESOLUTION,
  };
  const warpedMapLayer = new WarpedMapLayer(warpedMapLayerOptions);

  const getUniqueAnnotations = (annotations: WarpedMapProps[]) =>
    annotations.reduce((acc: WarpedMapProps[], current) => {
      const annotationExists = acc.some(
        (annotation) => annotation.url === current.url,
      );
      if (!annotationExists) {
        acc.push(current);
      }
      return acc;
    }, []);

  const getAnnotationsFromChapters = (chapters: MapChapterProps[]) =>
    getUniqueAnnotations(
      chapters.flatMap((chapter) => chapter.warpedMaps ?? []),
    );

  const areAnnotationsLoaded = (annotations: WarpedMapProps[]) =>
    annotations.every(({ url }) => mapIdsByAnnotationUrl.has(url));

  const getMapIdsForAnnotationUrl = (url: string) =>
    mapIdsByAnnotationUrl.get(url) ?? [];

  const getMapIdsForAnnotations = (annotations: WarpedMapProps[]) =>
    annotations.flatMap(({ url }) => getMapIdsForAnnotationUrl(url));

  const getWarpedMapStateKey = (annotations: WarpedMapProps[]) =>
    JSON.stringify(
      annotations.map(({ url, options }) => ({
        url,
        mapIds: getMapIdsForAnnotationUrl(url),
        options,
      })),
    );

  const getNativeMaxZoomForAnnotations = (annotations: WarpedMapProps[]) => {
    const nativeMaxZooms = getMapIdsForAnnotations(annotations)
      .map((id) => warpedMapLayer.getWarpedMap(id)?.resourceToProjectedGeoScale)
      .filter(
        (scale): scale is number =>
          typeof scale === "number" && Number.isFinite(scale) && scale > 0,
      )
      .map((scale) =>
        Math.log2((scale * WEB_MERCATOR_WORLD_WIDTH) / MAPLIBRE_TILE_SIZE),
      );

    return nativeMaxZooms.length > 0 ? Math.max(...nativeMaxZooms) : undefined;
  };

  const rememberMapIdsForAnnotation = (url: string, ids: string[]) => {
    mapIdsByAnnotationUrl.set(url, ids);
    ids.forEach((id) => {
      annotationUrlByMapId.set(id, url);
    });
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

  const cloneLayer = (layer: LayerSpecification): LayerSpecification =>
    JSON.parse(JSON.stringify(layer)) as LayerSpecification;

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

  const getLayerOriginalId = (
    basemapStyle: ResolvedBasemapStyle,
    layerId: string,
  ) => basemapStyle.originalLayerIdById.get(layerId) ?? layerId;

  const isLayerHiddenByConfig = (
    basemapStyle: ResolvedBasemapStyle,
    layerId: string,
    layerState: EffectiveBasemapLayerState,
  ) => {
    const originalLayerId = getLayerOriginalId(basemapStyle, layerId);

    return (
      layerState.hiddenLayers.has(layerId) ||
      layerState.hiddenLayers.has(originalLayerId)
    );
  };

  const getBasemapLayerVisibility = (
    basemapStyle: ResolvedBasemapStyle,
    layerId: string,
    isLabelLayer: boolean,
    layerState: EffectiveBasemapLayerState,
  ): "visible" | "none" => {
    if (currentHideBasemap) return "none";
    if (isLayerHiddenByConfig(basemapStyle, layerId, layerState)) return "none";
    if (isLabelLayer && !layerState.labels.visible) return "none";

    return basemapStyle.defaultVisibilityById.get(layerId) ?? "visible";
  };

  const getLayerWithVisibility = (
    basemapStyle: ResolvedBasemapStyle,
    layer: LayerSpecification,
    isLabelLayer: boolean,
    layerState: EffectiveBasemapLayerState,
  ): LayerSpecification => {
    const nextLayer = cloneLayer(layer);

    nextLayer.layout = {
      ...(nextLayer.layout ?? {}),
      visibility: getBasemapLayerVisibility(
        basemapStyle,
        nextLayer.id,
        isLabelLayer,
        layerState,
      ),
    };

    return nextLayer;
  };

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

  const applyCurrentBasemapStyle = async () => {
    const styleKey = basemapStyleKey;

    if (styleKey === loadedBasemapStyleKey) {
      applyBasemapLayerState();
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

    if (mapLoaded) {
      applyBasemapLayerState();
    }

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

  const getCameraLayoutOptions = (
    padding: number | PaddingOptions,
  ): CameraLayoutOptions => {
    if (typeof padding === "number") {
      return { padding };
    }

    const top = padding.top ?? DEFAULT_PADDING;
    const right = padding.right ?? DEFAULT_PADDING;
    const bottom = padding.bottom ?? DEFAULT_PADDING;
    const left = padding.left ?? DEFAULT_PADDING;
    const horizontalPadding = (left + right) / 2;
    const verticalPadding = (top + bottom) / 2;
    const offset: [number, number] = [
      (left - right) / 2,
      (top - bottom) / 2,
    ];

    return {
      padding: {
        top: verticalPadding,
        right: horizontalPadding,
        bottom: verticalPadding,
        left: horizontalPadding,
      },
      offset,
    };
  };

  const getCameraForBoundsOptions = (
    cameraLayoutOptions: CameraLayoutOptions,
  ): CameraForBoundsOptions => ({
    ...cameraLayoutOptions,
    ...(currentLocation.bearing !== undefined
      ? { bearing: currentLocation.bearing }
      : {}),
  });

  const getBoundsCenter = (bounds: LngLatBoundsLike): [number, number] => {
    const center = maplibregl.LngLatBounds.convert(bounds).getCenter();

    return [center.lng, center.lat];
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

          const id = warpedMapLayer.addGeoreferencedMap(georeferencedMap, {
            visible: false,
          });
          rememberMapIdsForAnnotation(url, [id]);
        } else {
          const georeferenceAnnotation = await fetch(url).then((response) =>
            response.json(),
          );

          if (destroyed) return;

          const ids = warpedMapLayer.addGeoreferenceAnnotation(georeferenceAnnotation, {
            visible: false,
          });

          const stringIds = ids.filter(
            (i): i is string => typeof i === "string",
          );
          const errors = ids.filter((i) => i instanceof Error);
          if (errors.length) {
            console.error("Failed to add georeferenced map for", url, errors);
          }
          rememberMapIdsForAnnotation(url, stringIds);
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

  function setWarpedMaps() {
    layoutRevision;
    resetSignal;

    const cameraLayoutOptions = getCameraLayoutOptions(currentPadding);

    currentSlideResourcesRevision;

    if (mapLoaded && currentWarpedMaps && !currentSlideResourcesReady()) return;

    if (mapLoaded && currentWarpedMaps) {
      const hiddenUrlSet = new Set(latestHiddenWarpedMapUrls);
      const warpedMapStateKey = getWarpedMapStateKey(currentWarpedMaps);
      const shouldApplyWarpedMapState =
        warpedMapStateKey !== appliedWarpedMapStateKey;
      // Get all IDs
      const optionsByMapId = new Map();
      currentWarpedMaps
        .slice()
        // For correct order
        .reverse()
        .forEach((annotation) => {
          const { url, options } = annotation;
          const annotationIds = mapIdsByAnnotationUrl.get(url);
          if (annotationIds) {
            if (shouldApplyWarpedMapState) {
              warpedMapLayer.bringMapsToFront(annotationIds);
            }
            annotationIds.forEach((id: string) => {
              optionsByMapId.set(id, {
                ...DEFAULT_WARPED_MAP_OPTIONS,
                ...options,
                visible: !hiddenUrlSet.has(url),
              });
            });
          }
        });

      // Check which maps to hide and show
      // const mapsToShow = mapIds.filter((id) => !visibleMaps.includes(id))
      const mapsToHide = visibleMaps.filter((id) => !optionsByMapId.has(id));
      const mapIds = Array.from(optionsByMapId.keys());

      mapsToHide.forEach((id) => {
        optionsByMapId.set(id, {
          visible: false,
          ...DEFAULT_WARPED_MAP_OPTIONS,
        });
      });
      if (shouldApplyWarpedMapState) {
        if (debug) {
          console.log("Setting current warped maps...", {
            chapterIndex: index,
            mapCount: mapIds.length,
            currentWarpedMaps,
            optionsByMapId,
            visibleMaps,
          });
        }
        warpedMapLayer.setMapsOptions((mapId) => optionsByMapId.get(mapId));
        appliedWarpedMapStateKey = warpedMapStateKey;
      }

      visibleMaps = mapIds;
      currentVisibleMaps = mapIds;

      let mapIdsForBounds: string[] = [];
      const boundsFilter = currentWarpedMaps.filter(
        (annotation) => annotation.useBounds === true,
      );
      if (boundsFilter.length) {
        boundsFilter.forEach(({ url }) => {
          const ids = mapIdsByAnnotationUrl.get(url);
          if (ids) {
            mapIdsForBounds.push(...ids);
          }
        });
      } else mapIdsForBounds = mapIds;

      let camera: CenterZoomBearing | undefined;
      let forceCameraOffset = false;
      const bounds = warpedMapLayer.getMapsBounds(mapIdsForBounds);
      setDebugBounds(bounds);
      const locationBearing = currentLocation.bearing;

      const firstMapWithBearingProp = currentWarpedMaps.find(
        (annotation) => annotation.useBearing == true,
      );
      if (firstMapWithBearingProp && locationBearing === undefined) {
        const warpedMapIdsUsedForBearing =
          mapIdsByAnnotationUrl.get(firstMapWithBearingProp.url) || [];
        const sortedMapIds: Set<string> = new Set(
          warpedMapIdsUsedForBearing.concat(mapIdsForBounds),
        );
        camera = warpedMapLayer.getMapsCenterZoomBearing([...sortedMapIds], {
          bearingSelection: "first",
          ...cameraLayoutOptions,
        });
        forceCameraOffset = true;
      } else if (bounds) {
        camera = map.cameraForBounds(
          bounds,
          getCameraForBoundsOptions(cameraLayoutOptions),
        );

        if (camera && locationBearing !== undefined && !currentLocation.center) {
          camera = {
            ...camera,
            center: getBoundsCenter(bounds),
          };
          forceCameraOffset = true;
        }
      }
      const mapsUsedForZoom = currentWarpedMaps.filter(
        (annotation) => annotation.useZoom === true,
      );
      const nativeMaxZoom = mapsUsedForZoom.length
        ? getNativeMaxZoomForAnnotations(mapsUsedForZoom)
        : undefined;
      if (camera && nativeMaxZoom !== undefined) {
        camera = {
          ...camera,
          zoom: nativeMaxZoom,
        };
      }
      if (camera) {
        if (debug) {
          console.log("Updating warped map camera...", {
            chapterIndex: index,
            camera,
            padding: currentPadding,
          });
        }
        flyToCamera(camera, cameraLayoutOptions, forceCameraOffset);
      }
    } else if (mapLoaded) {
      // Hide all maps
      const mapsToHide = new Set(visibleMaps);
      if (mapsToHide.size) {
        warpedMapLayer.setMapsOptions((mapId) =>
          mapsToHide.has(mapId) ? { visible: false } : undefined,
        );
      }
      visibleMaps = [];
      currentVisibleMaps = [];
      appliedWarpedMapStateKey = undefined;
      setDebugBounds();
    }
  }

  function setWarpedMapVisibilityOverrides(hiddenUrls: string[]) {
    latestHiddenWarpedMapUrls = hiddenUrls;

    if (!mapLoaded || !currentVisibleMaps.length) return;

    const hiddenUrlSet = new Set(hiddenUrls);
    const currentVisibleMapSet = new Set(currentVisibleMaps);

    warpedMapLayer.setMapsOptions((mapId) => {
      if (!currentVisibleMapSet.has(mapId)) return undefined;

      const url = annotationUrlByMapId.get(mapId);
      if (!url) return undefined;

      return {
        visible: !hiddenUrlSet.has(url),
      };
    });
  }

  function highlightMaps() {
    currentSlideResourcesRevision;

    if (!mapLoaded) return;
    if (!highlight && highlightedMaps.length === 0) return;

    if (highlight) {
      if (debug) {
        console.log("Highlighting maps...", highlight);
      }
      const ids = getMapIdsForAnnotationUrl(highlight);
      const nextHighlightedMapSet = new Set(ids);
      const mapsToUpdate = new Set([...highlightedMaps, ...ids]);

      warpedMapLayer.setMapsOptions((mapId) =>
        mapsToUpdate.has(mapId)
          ? { renderMask: nextHighlightedMapSet.has(mapId) }
          : undefined,
      );

      highlightedMaps = ids;
    } else {
      const mapsToUnhighlight = new Set(highlightedMaps);

      warpedMapLayer.setMapsOptions((mapId) =>
        mapsToUnhighlight.has(mapId) ? { renderMask: false } : undefined,
      );
      highlightedMaps = [];
    }
  }

  function zoomToWarpedMapBounds() {
    const signal = zoomToWarpedMapSignal;
    const url = zoomToWarpedMapUrl;

    currentSlideResourcesRevision;

    if (
      !mapLoaded ||
      !url ||
      signal === 0 ||
      signal === handledZoomToWarpedMapSignal
    ) {
      return;
    }

    const ids = getMapIdsForAnnotationUrl(url);
    if (!ids.length) return;

    const cameraLayoutOptions = getCameraLayoutOptions(currentPadding);
    let camera: CenterZoomBearing;

    try {
      camera = warpedMapLayer.getMapsCenterZoomBearing(ids, {
        bearingSelection: "first",
        ...cameraLayoutOptions,
      });
    } catch (error) {
      console.error("Failed to zoom to warped map layer", url, error);
      handledZoomToWarpedMapSignal = signal;
      return;
    }

    flyToCamera(camera, cameraLayoutOptions, true, false);
    handledZoomToWarpedMapSignal = signal;
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
      if (opacity === 0) {
        warpedMapLayer.setOpacity(1);
      } else {
        warpedMapLayer.setOpacity(0);
      }
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

    layerList
      .map((layer) => ({
        ...layer,
        id: `user-${layer.id}`,
      }))
      .reverse()
      .forEach((layer) => {
        const vectorTypes = ["symbol", "circle", "line", "raster", "fill"];
        const moveToFront = vectorTypes.includes(layer.type);
        map.addLayer(layer, moveToFront ? undefined : "warped-map-layer");
      });
  }

  function getLayerPaintType(id: string) {
    const layerType = map.getLayer(id)?.type;
    if (layerType && layerType in LAYER_TYPES) {
      return LAYER_TYPES[layerType as keyof typeof LAYER_TYPES];
    }
  }

  function setLayersOpacity() {
    if (mapLoaded && currentLayers) {
      if (debug) {
        console.log("Setting current layers opacity...", currentLayers);
      }
      currentLayers.forEach((layer) => {
        const id = `user-${layer.layer}`;
        if (layer.visibility) {
          map.setLayoutProperty(id, "visibility", layer.visibility);
        }
        if (layer.opacity !== undefined) {
          const paintProps = getLayerPaintType(id);
          if (paintProps) {
            paintProps.forEach((prop) => {
              let options = {};
              if (layer.duration) {
                const transitionProp = `${prop}-transition`;
                options = { duration: layer.duration };
                map.setPaintProperty(id, transitionProp, options);
              }
              map.setPaintProperty(id, prop, layer.opacity, options);
            });
          }
        }
      });
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
  $effect(setWarpedMaps);
  $effect(() => setWarpedMapVisibilityOverrides(hiddenWarpedMapUrls));
  $effect(highlightMaps);
  $effect(zoomToWarpedMapBounds);
  $effect(setLayersOpacity);
  $effect(() => {
    if (!mapLoaded) return;
    void applyCurrentBasemapStyle();
  });
  $effect(() => {
    if (basemapStyleKey !== loadedBasemapStyleKey) return;
    applyBasemapLayerState();
  });
  $effect(setLocation);

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: createEmptyMapStyle(basemapTheme),
      maxPitch: 0,
      attributionControl: false,
      center: [0, 0],
      zoom: 14,
      bearingSnap: 0,
      keyboard: false,
    });
    const updateBearing = () => {
      currentBearing = map.getBearing();
    };

    map.on("move", updateBearing);

    map.on("styleimagemissing", async (event) => {
      const id = event.id;
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

      if (debug) {
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
    class="pointer-events-none absolute top-3 right-3 z-10 flex flex-col gap-2 sm:top-4 sm:right-4 md:top-auto md:right-auto md:bottom-5 md:left-5 md:flex-row"
  >
    <button
      type="button"
      class="pointer-events-auto inline-flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-lg bg-[var(--app-map-control-bg)] text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md"
      aria-label="Zoom in"
      title="Zoom in"
      onclick={zoomIn}
    >
      <Plus size={24} aria-hidden="true" />
    </button>

    <button
      type="button"
      class="pointer-events-auto inline-flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-lg bg-[var(--app-map-control-bg)] text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md"
      aria-label="Zoom out"
      title="Zoom out"
      onclick={zoomOut}
    >
      <Minus size={24} aria-hidden="true" />
    </button>

    <button
      type="button"
      class="pointer-events-auto inline-flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-lg bg-[var(--app-map-control-bg)] text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md"
      aria-label="Reset north"
      title="Reset north"
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
