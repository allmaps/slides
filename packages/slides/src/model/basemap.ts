import {
  layers as getProtomapsLayers,
  namedFlavor,
  type Flavor,
} from "@protomaps/basemaps";
import type {
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

import {
  DEFAULT_DARK_FLAVOR,
  DEFAULT_LIGHT_FLAVOR,
  DEFAULT_LOCALE,
} from "./settings.ts";
import type {
  BasemapLabelPosition,
  BasemapStyleReference,
  MapConfig,
  ProtomapsFlavorOverrides,
  ProtomapsStyleConfig,
  ThemeMode,
} from "./types.ts";

export const BASEMAP_LAYER_PREFIX = "basemap:";
export const BASEMAP_SOURCE_PREFIX = "basemap:";
export const FOREGROUND_LAYER_ID = "foreground";

const PROTOMAPS_SOURCE_ID = "protomaps";
const PROTOMAPS_ATTRIBUTION =
  '<a href="https://github.com/protomaps/basemaps">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>';
const DEFAULT_GLYPHS =
  "https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf";
const DEFAULT_SPRITES = {
  light: "https://protomaps.github.io/basemaps-assets/sprites/v4/light",
  dark: "https://protomaps.github.io/basemaps-assets/sprites/v4/dark",
};
const DEFAULT_FOREGROUND_COLORS = {
  light: "#cccccc",
  dark: "#34373d",
};
const DEFAULT_LABEL_POSITION: BasemapLabelPosition = "belowWarpedMaps";

type ResolvedProtomapsConfig = {
  key?: string;
  locale?: string;
  glyphs?: string;
  sprite?: string;
  flavor?: string | ProtomapsFlavorOverrides;
  overrides: Partial<Record<ThemeMode, ProtomapsFlavorOverrides>>;
};

export type EffectiveBasemapStyleConfig = {
  style?: BasemapStyleReference;
  foregroundColor?: string;
  protomaps: ResolvedProtomapsConfig;
};

export type EffectiveBasemapLayerState = {
  labels: {
    visible: boolean;
    position: BasemapLabelPosition;
  };
  hiddenLayers: Set<string>;
};

export type ResolvedBasemapStyle = {
  sources: Record<string, SourceSpecification>;
  baseLayers: LayerSpecification[];
  labelLayers: LayerSpecification[];
  sourceIds: string[];
  baseLayerIds: string[];
  labelLayerIds: string[];
  layerIds: string[];
  originalLayerIdById: Map<string, string>;
  defaultVisibilityById: Map<string, "visible" | "none">;
  glyphs?: StyleSpecification["glyphs"];
  sprite?: StyleSpecification["sprite"];
  foregroundColor: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const sortForKey = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortForKey);

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortForKey(entry)]),
    );
  }

  return value;
};

const stableStringify = (value: unknown) => JSON.stringify(sortForKey(value));

const getThemeValue = <T>(
  values: Partial<Record<ThemeMode, T>> | undefined,
  theme: ThemeMode,
) => values?.[theme];

const getLastDefined = <T>(values: Array<T | undefined>) => {
  for (const value of values.toReversed()) {
    if (value !== undefined) return value;
  }

  return undefined;
};

const getLastThemeValue = <Config, T>(
  configs: Array<Config | undefined>,
  getter: (config: Config) => Partial<Record<ThemeMode, T>> | undefined,
  theme: ThemeMode,
) => {
  for (const config of configs.toReversed()) {
    const values = config ? getter(config) : undefined;
    if (values !== undefined) return getThemeValue(values, theme);
  }

  return undefined;
};

const mergeRecord = (
  base: Record<string, unknown>,
  value: Record<string, unknown>,
): Record<string, unknown> => {
  const merged = { ...base };

  for (const [key, entry] of Object.entries(value)) {
    const previous = merged[key];

    merged[key] =
      isRecord(previous) && isRecord(entry)
        ? mergeRecord(previous, entry)
        : entry;
  }

  return merged;
};

const mergeObject = <T>(...values: Array<T | undefined>) =>
  values.reduce<Record<string, unknown>>(
    (merged, value) => (isRecord(value) ? mergeRecord(merged, value) : merged),
    {},
  ) as T;

const normalizeSpriteConfig = (
  config: ProtomapsStyleConfig | undefined,
  theme: ThemeMode,
) => {
  if (!config) return undefined;

  if (typeof config.sprite === "string") return config.sprite;
  if (isRecord(config.sprite)) {
    const sprite = getThemeValue(
      config.sprite as Partial<Record<ThemeMode, string>>,
      theme,
    );
    if (sprite) return sprite;
  }

  return getThemeValue(config.sprites, theme);
};

const getOverridesForTheme = (
  overrides: ProtomapsStyleConfig["overrides"],
  theme: ThemeMode,
): ProtomapsFlavorOverrides | undefined => {
  if (!isRecord(overrides)) return undefined;

  const overridesRecord = overrides as Record<string, unknown>;

  if (isRecord(overridesRecord.light) || isRecord(overridesRecord.dark)) {
    return isRecord(overridesRecord[theme])
      ? (overridesRecord[theme] as ProtomapsFlavorOverrides)
      : undefined;
  }

  return overrides as ProtomapsFlavorOverrides;
};

const mergeProtomapsConfig = (
  configs: Array<ProtomapsStyleConfig | undefined>,
  theme: ThemeMode,
  locale: string | undefined,
): ResolvedProtomapsConfig => ({
  key: getLastDefined(configs.map((config) => config?.key)) || undefined,
  locale:
    getLastDefined(configs.map((config) => config?.locale ?? config?.lang)) ??
    locale,
  glyphs: getLastDefined(configs.map((config) => config?.glyphs)),
  sprite: getLastDefined(
    configs.map((config) => normalizeSpriteConfig(config, theme)),
  ),
  flavor: getLastDefined(
    configs.map(
      (config) => getThemeValue(config?.flavors, theme) ?? config?.flavor,
    ),
  ),
  overrides: {
    light: mergeObject<ProtomapsFlavorOverrides>(
      ...configs.map((config) =>
        getOverridesForTheme(config?.overrides, "light"),
      ),
    ),
    dark: mergeObject<ProtomapsFlavorOverrides>(
      ...configs.map((config) =>
        getOverridesForTheme(config?.overrides, "dark"),
      ),
    ),
  },
});

export const getEffectiveBasemapStyleConfig = ({
  theme,
  locale,
  appMap,
  appProtomaps,
  slideshowMap,
  chapterMap,
}: {
  theme: ThemeMode;
  locale?: string;
  appMap?: MapConfig;
  appProtomaps?: ProtomapsStyleConfig;
  slideshowMap?: MapConfig;
  chapterMap?: MapConfig;
}): EffectiveBasemapStyleConfig => {
  const mapConfigs = [appMap, slideshowMap, chapterMap];

  return {
    style: getLastThemeValue(mapConfigs, (config) => config.styles, theme),
    foregroundColor: getLastThemeValue(
      mapConfigs,
      (config) => config.foreground,
      theme,
    ),
    protomaps: mergeProtomapsConfig(
      [
        appProtomaps,
        appMap?.protomaps,
        slideshowMap?.protomaps,
        chapterMap?.protomaps,
      ],
      theme,
      locale,
    ),
  };
};

export const getEffectiveBasemapTheme = (
  theme: ThemeMode,
  ...mapConfigs: Array<MapConfig | undefined>
): ThemeMode =>
  getLastDefined(mapConfigs.map((config) => config?.theme)) ?? theme;

export const getEffectiveBasemapLayerState = (
  ...mapConfigs: Array<MapConfig | undefined>
): EffectiveBasemapLayerState => {
  const labels = mapConfigs.reduce<EffectiveBasemapLayerState["labels"]>(
    (merged, config) => ({
      visible: config?.labels?.visible ?? merged.visible,
      position: config?.labels?.position ?? merged.position,
    }),
    {
      visible: false,
      position: DEFAULT_LABEL_POSITION,
    },
  );
  const hiddenLayers = new Set<string>();

  mapConfigs.forEach((config) => {
    config?.hiddenLayers?.forEach((layer) => hiddenLayers.add(layer));
  });

  return { labels, hiddenLayers };
};

export const getBasemapStyleKey = ({
  theme,
  config,
}: {
  theme: ThemeMode;
  config: EffectiveBasemapStyleConfig;
}) => stableStringify({ theme, config });

const getLocalStyleKeys = (path: string) => {
  const trimmedPath = path.trim();
  const cleanPath = trimmedPath.replace(/^\.?\//, "").replace(/^\/+/, "");
  const candidatePaths = cleanPath.startsWith("assets/")
    ? [cleanPath]
    : [
        cleanPath,
        `assets/map-styles/${cleanPath}`,
        `assets/styles/${cleanPath}`,
      ];

  return candidatePaths.map((candidatePath) => `./${candidatePath}`);
};

const resolveConfiguredStyle = async (
  styleReference: BasemapStyleReference,
  fetchFn: typeof fetch = fetch,
  strict = false,
  mapStyleFiles: Record<string, unknown> = {},
): Promise<StyleSpecification | undefined> => {
  if (typeof styleReference !== "string") return cloneJson(styleReference);

  for (const key of getLocalStyleKeys(styleReference)) {
    const style = mapStyleFiles[key];
    if (style) return cloneJson(style) as StyleSpecification;
  }

  try {
    const response = await fetchFn(styleReference);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }

    const style = (await response.json()) as StyleSpecification;

    return resolveStyleUrls(style, response.url || styleReference);
  } catch (error) {
    if (strict) throw error;
    console.warn(
      `Could not load basemap style ${styleReference}. Falling back to Protomaps.\n  - ${error instanceof Error ? error.message : String(error)}`,
    );

    return undefined;
  }
};

const isAbsoluteUrl = (value: string) => /^[a-z][a-z\d+.-]*:/i.test(value);

const resolveRelativeUrl = (value: string, baseUrl: string) => {
  if (isAbsoluteUrl(value)) return value;

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
};

const resolveStyleUrls = (
  style: StyleSpecification,
  styleUrl: string,
): StyleSpecification => {
  const resolvedStyle = cloneJson(style);

  if (resolvedStyle.glyphs) {
    resolvedStyle.glyphs = resolveRelativeUrl(resolvedStyle.glyphs, styleUrl);
  }

  if (typeof resolvedStyle.sprite === "string") {
    resolvedStyle.sprite = resolveRelativeUrl(resolvedStyle.sprite, styleUrl);
  }

  for (const source of Object.values(resolvedStyle.sources ?? {})) {
    const sourceRecord = source as SourceSpecification & {
      url?: string;
      tiles?: string[];
    };

    if (sourceRecord.url) {
      sourceRecord.url = resolveRelativeUrl(sourceRecord.url, styleUrl);
    }
    if (sourceRecord.tiles) {
      sourceRecord.tiles = sourceRecord.tiles.map((tileUrl) =>
        resolveRelativeUrl(tileUrl, styleUrl),
      );
    }
  }

  return resolvedStyle;
};

const resolveProtomapsFlavor = (
  theme: ThemeMode,
  config: ResolvedProtomapsConfig,
): Flavor => {
  const defaultFlavorName =
    theme === "dark" ? DEFAULT_DARK_FLAVOR : DEFAULT_LIGHT_FLAVOR;
  const configuredFlavor = config.flavor;
  const defaultFlavor = namedFlavor(defaultFlavorName);
  const baseFlavor =
    typeof configuredFlavor === "string"
      ? namedFlavor(configuredFlavor)
      : mergeObject<Flavor>(
          defaultFlavor,
          configuredFlavor as Flavor | undefined,
        );

  return mergeObject<Flavor>(
    baseFlavor,
    config.overrides[theme] as Flavor | undefined,
  );
};

const createProtomapsStyle = (
  theme: ThemeMode,
  config: ResolvedProtomapsConfig,
): StyleSpecification => {
  const key = config.key ?? "";
  const flavor = resolveProtomapsFlavor(theme, config);
  const locale = config.locale ?? DEFAULT_LOCALE;

  return {
    version: 8,
    glyphs: config.glyphs ?? DEFAULT_GLYPHS,
    sprite: config.sprite ?? DEFAULT_SPRITES[theme],
    sources: {
      [PROTOMAPS_SOURCE_ID]: {
        attribution: PROTOMAPS_ATTRIBUTION,
        type: "vector",
        url: `https://api.protomaps.com/tiles/v4.json?key=${encodeURIComponent(key)}`,
        maxzoom: 15,
      },
    },
    layers: [
      ...getProtomapsLayers(PROTOMAPS_SOURCE_ID, flavor),
      ...getProtomapsLayers(PROTOMAPS_SOURCE_ID, flavor, {
        lang: locale,
        labelsOnly: true,
      }),
    ] as LayerSpecification[],
  };
};

const prefixId = (prefix: string, id: string) =>
  id.startsWith(prefix) ? id : `${prefix}${id}`;

const prefixBasemapStyle = (style: StyleSpecification) => {
  const sourceIdByOriginalId = new Map<string, string>();
  const sources = Object.fromEntries(
    Object.entries(style.sources ?? {}).map(([sourceId, source]) => {
      const prefixedSourceId = prefixId(BASEMAP_SOURCE_PREFIX, sourceId);
      sourceIdByOriginalId.set(sourceId, prefixedSourceId);

      return [prefixedSourceId, cloneJson(source) as SourceSpecification];
    }),
  );
  const layers = (style.layers ?? []).map((layer) => {
    const originalLayerId = layer.id;
    const prefixedLayer = cloneJson(layer) as LayerSpecification & {
      source?: string;
      metadata?: Record<string, unknown>;
    };

    prefixedLayer.id = prefixId(BASEMAP_LAYER_PREFIX, originalLayerId);

    if (prefixedLayer.source) {
      prefixedLayer.source =
        sourceIdByOriginalId.get(prefixedLayer.source) ?? prefixedLayer.source;
    }

    prefixedLayer.metadata = {
      ...(isRecord(prefixedLayer.metadata) ? prefixedLayer.metadata : {}),
      "slides:original-layer-id": originalLayerId,
    };

    return prefixedLayer;
  });

  return { sources, layers };
};

const getLayerDefaultVisibility = (layer: LayerSpecification) => {
  const visibility = (
    layer.layout as { visibility?: "visible" | "none" } | undefined
  )?.visibility;

  return visibility === "none" ? "none" : "visible";
};

const getLayerOriginalId = (layer: LayerSpecification) => {
  const metadata = layer.metadata;

  return isRecord(metadata) &&
    typeof metadata["slides:original-layer-id"] === "string"
    ? metadata["slides:original-layer-id"]
    : layer.id;
};

const getStyleBackgroundColor = (style: StyleSpecification) => {
  const backgroundLayer = style.layers?.find(
    (layer) => layer.type === "background",
  );
  const backgroundColor = (
    backgroundLayer?.paint as { "background-color"?: unknown } | undefined
  )?.["background-color"];

  return typeof backgroundColor === "string" ? backgroundColor : undefined;
};

const getForegroundColor = (
  style: StyleSpecification,
  configuredColor: string | undefined,
  theme: ThemeMode,
) => {
  if (configuredColor && configuredColor !== "auto") return configuredColor;

  return getStyleBackgroundColor(style) ?? DEFAULT_FOREGROUND_COLORS[theme];
};

export const createEmptyMapStyle = (theme: ThemeMode): StyleSpecification => ({
  version: 8,
  sources: {},
  layers: [
    {
      id: FOREGROUND_LAYER_ID,
      type: "background",
      paint: {
        "background-color": DEFAULT_FOREGROUND_COLORS[theme],
        "background-opacity": 1,
      },
    },
  ],
});

export const resolveBasemapStyle = async ({
  theme,
  config,
  fetchFn,
  strict,
  mapStyleFiles = {},
}: {
  theme: ThemeMode;
  config: EffectiveBasemapStyleConfig;
  fetchFn?: typeof fetch;
  strict?: boolean;
  mapStyleFiles?: Record<string, unknown>;
}): Promise<ResolvedBasemapStyle> => {
  const configuredStyle = config.style
    ? await resolveConfiguredStyle(config.style, fetchFn, strict, mapStyleFiles)
    : undefined;
  const style =
    configuredStyle ?? createProtomapsStyle(theme, config.protomaps);
  const foregroundColor = getForegroundColor(
    style,
    config.foregroundColor,
    theme,
  );
  const { sources, layers } = prefixBasemapStyle(style);
  const sourceIds = Object.keys(sources);
  const baseLayers = layers.filter((layer) => layer.type !== "symbol");
  const labelLayers = layers.filter((layer) => layer.type === "symbol");
  const allLayers = [...baseLayers, ...labelLayers];

  return {
    sources,
    baseLayers,
    labelLayers,
    sourceIds,
    baseLayerIds: baseLayers.map((layer) => layer.id),
    labelLayerIds: labelLayers.map((layer) => layer.id),
    layerIds: allLayers.map((layer) => layer.id),
    originalLayerIdById: new Map(
      allLayers.map((layer) => [layer.id, getLayerOriginalId(layer)]),
    ),
    defaultVisibilityById: new Map(
      allLayers.map((layer) => [layer.id, getLayerDefaultVisibility(layer)]),
    ),
    glyphs: style.glyphs,
    sprite: style.sprite,
    foregroundColor,
  };
};

// Shared layer decisions for the live map and build-time rendering.
export function getBasemapLayerVisibility(
  style: ResolvedBasemapStyle,
  id: string,
  label: boolean,
  state: EffectiveBasemapLayerState,
  hidden = false,
): "visible" | "none" {
  const original = style.originalLayerIdById.get(id) ?? id;
  if (
    hidden ||
    state.hiddenLayers.has(id) ||
    state.hiddenLayers.has(original) ||
    (label && !state.labels.visible)
  )
    return "none";
  return style.defaultVisibilityById.get(id) ?? "visible";
}

export function getLayerWithVisibility(
  style: ResolvedBasemapStyle,
  layer: LayerSpecification,
  label: boolean,
  state: EffectiveBasemapLayerState,
  hidden = false,
): LayerSpecification {
  const next = structuredClone(layer);
  next.layout = {
    ...next.layout,
    visibility: getBasemapLayerVisibility(
      style,
      layer.id,
      label,
      state,
      hidden,
    ),
  };
  return next;
}
