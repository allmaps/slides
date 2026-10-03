import type { MapLibreWarpedMapLayerOptions } from "@allmaps/maplibre";
import type { Flavor } from "@protomaps/basemaps";
import type { LayerSpecification, SourceSpecification, StyleSpecification } from "maplibre-gl";
import type { ThemeConfig } from "./theme.ts";

export type ThemeMode = "light" | "dark";

export type BasemapStyleReference = string | StyleSpecification;

export type BasemapLabelPosition = "aboveWarpedMaps" | "belowWarpedMaps";

export type BasemapLabelsConfig = {
  visible?: boolean;
  position?: BasemapLabelPosition;
};

export type ProtomapsThemeValues<T> = Partial<Record<ThemeMode, T>>;

export type DeepPartial<T> = {
  [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key];
};

export type ProtomapsFlavorOverrides = DeepPartial<Flavor>;

export type ProtomapsStyleConfig = {
  key?: string;
  locale?: string;
  lang?: string;
  glyphs?: string;
  sprite?: string | ProtomapsThemeValues<string>;
  sprites?: ProtomapsThemeValues<string>;
  flavor?: string | ProtomapsFlavorOverrides;
  flavors?: ProtomapsThemeValues<string | ProtomapsFlavorOverrides>;
  overrides?:
    | ProtomapsFlavorOverrides
    | ProtomapsThemeValues<ProtomapsFlavorOverrides>;
};

export type MapConfig = {
  theme?: ThemeMode;
  styles?: Partial<Record<ThemeMode, BasemapStyleReference>>;
  labels?: BasemapLabelsConfig;
  hiddenLayers?: string[];
  foreground?: Partial<Record<ThemeMode, string>>;
  protomaps?: ProtomapsStyleConfig;
};

export type StartScreenTextConfig = {
  startButton?: string;
  madeWith?: string;
};

export type InterfaceConfig = {
  startScreen?: StartScreenTextConfig;
  /** Overrides for the app's English interface strings; supports {placeholders}. */
  text?: Record<string, string>;
};

export type SlidesConfig = {
  /** Short text for the interface and sharing images. */
  title: string;
  description?: string;
  /** Expanded text for page titles, metadata and structured data. */
  titleLong?: string;
  descriptionLong?: string;
  /** An Allmaps palette or custom fg/bg colors, optionally different per light/dark mode. */
  theme?: ThemeConfig;
  socialImage?: {
    /** Include the title and subtitle in sharing images (default: false). */
    textOverlay?: boolean;
    /** Title size at 1200 × 630, in pixels (default: 76); subtitle scales proportionally. */
    textSize?: number;
    font?: { family: string; path?: string };
  };
  main: string;
  slideshows: SlideshowDefinition[];
  sources: Record<string, SourceDefinition>;
  /** Defaults for generated layers, plus optional custom MapLibre layers. */
  layers?: UserLayerConfig[];
  map?: MapConfig;
  protomaps?: ProtomapsStyleConfig;
  interface?: InterfaceConfig;
  /** Shared Markdown credits, shown before any slideshow-specific credits. */
  credits?: string;
};

export type WarpedMapProps = {
  url: string;
  caption?: string;
  provenance?: string;
  homepage?: string;
  useBearing?: boolean;
  useBounds?: boolean;
  useZoom?: boolean;
  options?: Partial<MapLibreWarpedMapLayerOptions>;
  /** Overrides merged over options when the interface is in dark mode. */
  darkOptions?: Partial<MapLibreWarpedMapLayerOptions>;
};

export type MapLayerProps = {
  layer: string;
  opacity?: number;
  visibility?: "visible" | "none";
  duration?: number;
};

export type UserLayerConfig = MapLayerProps | LayerSpecification;

export type SubslideshowReference =
  | string
  | {
      id: string;
      title?: string;
    };

export type MapChapterProps = {
  map?: MapConfig;
  location?: {
    zoom?: number;
    center?: [number, number];
    duration?: number;
    bearing?: number;
  };
  sprite?: {
    json: string;
    image: string;
    dimensions: [number, number];
  };
  /** Fit map bounds to the available viewport; defaults to contain. */
  fit?: "cover" | "contain" | "equal";
  /** Uniform inner fitting margin in pixels; negative values enlarge the fit area. */
  padding?: number;
  hideBasemap?: boolean;
  warpedMaps?: WarpedMapProps[];
  layers?: MapLayerProps[];
  subslideshows?: SubslideshowReference[];
};

export type MapChapter = MapChapterProps & {
  slug: string;
  title: string;
  description?: string;
  sourcePath: string;
};

export type SourceDefinition = {
  type: string;
  path?: string;
  url?: string;
  [key: string]: unknown;
};

export type SlideshowDefinition = {
  id: string;
  path: string;
  slug?: string;
  title?: string;
  description?: string;
  /** Markdown credits, relative to the content root. */
  credits?: string;
  map?: MapConfig;
  start?: MapChapterProps;
};

export type Project = Pick<
  SlidesConfig,
  "title" | "description" | "titleLong" | "descriptionLong" | "theme" | "main" | "interface" | "credits"
> & {
  creditsTitle?: string;
  sources: Record<string, SourceSpecification>;
  slideshows: Slideshow[];
};

export type Slideshow = {
  id: string;
  path: string;
  slug: string;
  title: string;
  description?: string;
  credits?: string;
  creditsTitle?: string;
  map?: MapConfig;
  start?: MapChapterProps;
  chapters: MapChapter[];
  sources: Record<string, SourceSpecification>;
  /** Resolved global defaults, with internal layer IDs. */
  layers?: LayerSpecification[];
};
