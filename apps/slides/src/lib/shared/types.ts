import type { MapLibreWarpedMapLayerOptions } from "@allmaps/maplibre";
import type { SourceSpecification } from "maplibre-gl";

export type WarpedMapProps = {
  type?: "Image";
  url: string;
  caption?: string;
  homepage?: string;
  useBearing?: boolean;
  useBounds?: boolean;
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
