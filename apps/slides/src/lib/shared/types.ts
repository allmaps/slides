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

export type SlidesConfig = {
  map?: MapConfig;
  protomaps?: ProtomapsStyleConfig;
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
  Component: any;
};

export type ProjectSourceDefinition = {
  type: string;
  path?: string;
  url?: string;
  [key: string]: unknown;
};

export type ProjectSlideshowDefinition = {
  id: string;
  path: string;
  slug?: string;
  title?: string;
};

export type ProjectManifest = {
  id: string;
  slug: string;
  title: string;
  description?: string;
  map?: MapConfig;
  main: string;
  slideshows: ProjectSlideshowDefinition[];
  sources: Record<string, ProjectSourceDefinition>;
};

export type Project = Omit<ProjectManifest, "slideshows" | "sources"> & {
  folder: string;
  sources: Record<string, SourceSpecification>;
  slideshows: Slideshow[];
};

export type Slideshow = {
  id: string;
  path: string;
  slug: string;
  title: string;
  chapters: MapChapter[];
  sources: Record<string, SourceSpecification>;
};
