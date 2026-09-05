<script lang="ts">
  import { onMount } from "svelte";
  import { Minus, Plus } from "@lucide/svelte";

  import maplibregl from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";
  import type {
    SourceSpecification,
    LayerSpecification,
    CenterZoomBearing,
    CameraForBoundsOptions,
    FlyToOptions,
    LngLatBoundsLike,
    PaddingOptions,
    PointLike,
  } from "maplibre-gl";

  import {
    WarpedMapLayer,
    type MapLibreWarpedMapLayerOptions,
  } from "@allmaps/maplibre";
  import { createFauxGeoreferencedMap } from "$lib/shared/utils";
  import { getLayers, getStyleWithoutLayers } from "$lib/shared/basemap";
  import {
    DEFAULT_PADDING,
    DEFAULT_LIGHT_FLAVOR,
    DEFAULT_WARPED_MAP_OPTIONS,
    DEFAULT_LOCALE,
    DEFAULT_DURATION,
    DEFAULT_COLORS,
    DEFAULT_DARK_FLAVOR,
    DEFAULT_OVERVIEW_TILES_RESOLUTION,
    LAYER_TYPES,
  } from "$lib/shared/settings";

  import type { WarpedMapProps, MapChapterProps } from "$lib/shared/types";

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
    highlight?: string;
    showLabels?: boolean;
    anticipate?: boolean;
    layoutRevision?: number;
    resetSignal?: number;
    padding?: number | PaddingOptions;
  };

  let {
    chapters,
    index,
    isDarkMode,
    duration,
    locale,
    layers,
    sources,
    highlight,
    showLabels,
    anticipate,
    layoutRevision = 0,
    resetSignal = 0,
    padding,
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

  let map: maplibregl.Map;
  let container: HTMLElement;
  let mapLoaded = $state(false);
  let currentBearing = $state(0);
  let resourcesRevision = $state(0);
  let mapIdsByAnnotationUrl: Map<string, string[]> = new Map();
  let annotationLoadPromisesByUrl: Map<string, Promise<void>> = new Map();
  let spriteLoadPromisesByKey: Map<string, Promise<void>> = new Map();
  let spriteKeysByMapId: Map<string, Set<string>> = new Map();
  let visibleMaps: string[] = new Array();
  let imagesAdded: Set<string> = new Set();
  let highlightedMaps: string[] = [];
  let pmtilesProtocolLoaded = false;
  let destroyed = false;

  // For debugging
  const debug = false;
  const MAPLIBRE_TILE_SIZE = 512;
  const WEB_MERCATOR_WORLD_WIDTH = 40075016.68557849;

  // Initialize style and layers
  const flavor = isDarkMode ? DEFAULT_DARK_FLAVOR : DEFAULT_LIGHT_FLAVOR;
  const styleWithoutLayers = getStyleWithoutLayers(flavor);
  const styleLayers = getLayers(flavor);
  const symbolLayers = getLayers(flavor, undefined, {
    lang: locale ? locale : DEFAULT_LOCALE,
    labelsOnly: true,
  });
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

  const getMapIdsForAnnotations = (annotations: WarpedMapProps[]) =>
    annotations.flatMap(({ url }) => mapIdsByAnnotationUrl.get(url) ?? []);

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
  ) {
    const flyToOptions: FlyToOptions = {
      ...(camera ?? {}),
      ...currentLocation,
    };

    if (
      cameraLayoutOptions.offset &&
      (forceOffset ||
        currentLocation.center ||
        (camera === undefined && currentLocation.bearing !== undefined))
    ) {
      flyToOptions.offset = cameraLayoutOptions.offset;
    }

    const initialCameraUpdate = start;
    if (currentImageSlide || initialCameraUpdate) {
      flyToOptions.duration = 0;
    } else if (!currentLocation.duration && duration) {
      flyToOptions.duration = duration;
    }

    return { flyToOptions, initialCameraUpdate };
  }

  function flyToCamera(
    camera: CenterZoomBearing | undefined,
    cameraLayoutOptions: CameraLayoutOptions,
    forceOffset = false,
  ) {
    const { flyToOptions, initialCameraUpdate } = getFlyToOptions(
      camera,
      cameraLayoutOptions,
      forceOffset,
    );

    map.flyTo(flyToOptions);

    if (initialCameraUpdate) {
      setBasemapOpacityTransition();
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
          mapIdsByAnnotationUrl.set(url, [id]);
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
          mapIdsByAnnotationUrl.set(url, stringIds);
        }
      } catch (error) {
        if (!destroyed) {
          console.error("Failed to load georeferenced map for", url, error);
          mapIdsByAnnotationUrl.set(url, []);
        }
      } finally {
        annotationLoadPromisesByUrl.delete(url);
        if (!destroyed) {
          resourcesRevision += 1;
        }
      }
    })();

    annotationLoadPromisesByUrl.set(url, promise);

    return promise;
  }

  async function loadAnnotations(annotations: WarpedMapProps[]) {
    const uniqueAnnotations = getUniqueAnnotations(annotations).filter(
      ({ url }) => !mapIdsByAnnotationUrl.has(url),
    );

    if (debug) {
      console.log("Loading warped maps...", uniqueAnnotations);
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
        if (!destroyed) {
          resourcesRevision += 1;
        }
      }
    })();

    spriteLoadPromisesByKey.set(spriteKey, promise);

    return promise;
  }

  function setWarpedMaps() {
    layoutRevision;
    resetSignal;

    const cameraLayoutOptions = getCameraLayoutOptions(currentPadding);

    resourcesRevision;

    if (mapLoaded && currentWarpedMaps && !currentSlideResourcesReady()) return;

    if (mapLoaded && currentWarpedMaps) {
      // Get all IDs
      const optionsByMapId = new Map();
      const newMapIds = new Array();
      currentWarpedMaps
        .slice()
        // For correct order
        .reverse()
        .forEach((annotation) => {
          const { url, options } = annotation;
          const annotationIds = mapIdsByAnnotationUrl.get(url);
          if (annotationIds) {
            warpedMapLayer.bringMapsToFront(annotationIds);
            annotationIds.forEach((id: string) => {
              optionsByMapId.set(id, {
                visible: true,
                ...DEFAULT_WARPED_MAP_OPTIONS,
                ...options,
              });
              if (!visibleMaps.includes(id)) {
                // No longer used!
                newMapIds.push(id);
              }
            });
          }
        });

      // Check which maps to hide and show
      // const mapsToShow = mapIds.filter((id) => !visibleMaps.includes(id))
      const mapsToHide = visibleMaps.filter((id) => !optionsByMapId.has(id));
      const mapIds = optionsByMapId.keys().toArray();

      mapsToHide.forEach((id) => {
        optionsByMapId.set(id, {
          visible: false,
          ...DEFAULT_WARPED_MAP_OPTIONS,
        });
      });
      if (debug) {
        console.log("Setting current warped maps...", {
          currentWarpedMaps,
          optionsByMapId,
          visibleMaps,
        });
      }
      // Animation not working correctly
      // const animate = init ? false : slideDuration === 0 ? false : true
      warpedMapLayer.setMapsOptions((mapId) => optionsByMapId.get(mapId));

      visibleMaps = mapIds;

      let mapIdsForBounds = [];
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
      if (debug) {
        // console.log('Updating bounds layer', bounds)
        // const boundsSource = map.getSource('bounds') as maplibregl.GeoJSONSource
        // const features = featureCollection([bboxPolygon(bounds)])
        // if (boundsSource) {
        //   boundsSource.setData(features)
        // }
      }
      if (camera) {
        flyToCamera(camera, cameraLayoutOptions, forceCameraOffset);
      }
    } else if (mapLoaded) {
      // Hide all maps
      warpedMapLayer.setMapsOptions(visibleMaps, { visible: false });
    }
  }

  function highlightMaps() {
    resourcesRevision;

    if (mapLoaded && highlight) {
      if (debug) {
        console.log("Highlighting maps...", highlight);
      }
      const ids = mapIdsByAnnotationUrl.get(highlight);
      if (ids) {
        warpedMapLayer.setMapsOptions(ids, {
          renderMask: true,
        });
        highlightedMaps = ids;
      }
    } else if (mapLoaded) {
      warpedMapLayer.setMapsOptions(highlightedMaps, {
        renderMask: false,
      });
    }
  }

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

    map.resetNorth({ duration: 300 });
  };

  const zoomIn = () => {
    if (!mapLoaded) return;

    map.zoomIn({ duration: 300 });
  };

  const zoomOut = () => {
    if (!mapLoaded) return;

    map.zoomOut({ duration: 300 });
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

  function setBasemapVisiblity() {
    if (debug) {
      console.log("Setting current basemap visibility");
    }
    const alwaysShow = [warpedMapLayer?.id, "foreground"];
    if (mapLoaded && currentHideBasemap) {
      if (debug) {
        console.log("Changing basemap visibility...", currentHideBasemap);
      }
      map.setPaintProperty("foreground", "background-opacity", 1);

      for (const layer of map.getLayersOrder()) {
        if (!alwaysShow.includes(layer) && !layer.startsWith("user")) {
          map.setLayoutProperty(layer, "visibility", "none");
        }
      }
    } else if (mapLoaded) {
      map.setPaintProperty("foreground", "background-opacity", 0);

      for (const layer of map.getLayersOrder()) {
        if (!alwaysShow.includes(layer) && !layer.startsWith("user")) {
          map.setLayoutProperty(layer, "visibility", "visible");
        }
      }
    }
  }

  function setBasemapOpacityTransition() {
    if (debug) {
      console.log("Setting foreground opacity-transition");
    }
    start = false;
    map.setPaintProperty("foreground", "background-opacity-transition", {
      duration: duration || DEFAULT_DURATION,
    });
  }

  $effect(() => {
    if (!mapLoaded) return;

    const currentAnnotations = currentWarpedMaps ?? [];
    const currentSprite = sprite;
    const currentChapters = chapters;
    let cancelled = false;

    void (async () => {
      await loadAnnotations(currentAnnotations);
      if (cancelled) return;

      await loadSpriteForMapIds(
        currentSprite,
        getMapIdsForAnnotations(currentAnnotations),
      );
      if (cancelled) return;

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
  $effect(highlightMaps);
  $effect(setLayersOpacity);
  $effect(setBasemapVisiblity);
  $effect(setLocation);

  onMount(() => {
    map = new maplibregl.Map({
      container,
      style: styleWithoutLayers,
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

    map.on("load", async () => {
      // Add layers
      styleLayers.forEach((layer) => map.addLayer(layer, "foreground"));

      map.addLayer(warpedMapLayer);

      if (sources && layers) {
        await loadSources(sources);
        loadLayers(layers);
      }

      if (showLabels) {
        symbolLayers.forEach((layer) => map.addLayer(layer));
      }

      map.on("styleimagemissing", async (event) => {
        const id = event.id;
        if (!imagesAdded.has(id)) {
          imagesAdded.add(id);
          const image = await map.loadImage(id);
          map.addImage(id, image.data);
        }
      });

      if (debug) {
        // Debug layer to show bounds
        map.addSource("bounds", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });
        map.addLayer({
          id: `bounds-layer`,
          type: "line",
          source: "bounds",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": DEFAULT_COLORS.blue.stroke,
            "line-width": 8,
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
