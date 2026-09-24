import type { MapLibreWarpedMapLayerOptions } from "@allmaps/maplibre";
import type { Flavor } from "@protomaps/basemaps";
import type { SourceSpecification, StyleSpecification } from "maplibre-gl";

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
  chapterCountSingular?: string;
  chapterCountPlural?: string;
  madeWith?: string;
};

export type InterfaceConfig = {
  startScreen?: StartScreenTextConfig;
  /** Overrides for the app's English interface strings; supports {placeholders}. */
  text?: Record<string, string>;
};

export type SlidesConfig = {
  title: string;
  description?: string;
  main: string;
  slideshows: SlideshowDefinition[];
  sources: Record<string, SourceDefinition>;
  map?: MapConfig;
  protomaps?: ProtomapsStyleConfig;
  interface?: InterfaceConfig;
  /** Shared Markdown credits, shown before any slideshow-specific credits. */
  credits?: string;
};

export type WarpedMapProps = {
  type?: "Image";
  url: string;
  caption?: string;
  provenance?: string;
  homepage?: string;
  useBearing?: boolean;
  useBounds?: boolean;
  useZoom?: boolean;
  options?: Partial<MapLibreWarpedMapLayerOptions>;
  region?: [number, number, number, number];
  wiggle?: boolean;
};

export type MapLayerProps = {
  layer: string;
  opacity?: number;
  visibility?: "visible" | "none";
  duration?: number;
};

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
  caption?: string;
  freeze?: boolean;
  padding?: number;
  fit?: "cover" | "contain" | "equal" | undefined;
  hideBasemap?: boolean;
  contain?: boolean;
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
  "title" | "description" | "main" | "interface" | "credits"
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
};
