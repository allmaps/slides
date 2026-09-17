import type { GeoreferencedMap } from "@allmaps/annotation";
import type { StyleSpecification } from "maplibre-gl";
import type { WarpedMapProps } from "@allmaps/slides-model/types";
import type { Camera } from "@allmaps/slides-model/map/camera";
import type { SourceAssets } from "./sources.ts";

export type RenderLayer = {
  props: WarpedMapProps;
  maps: Array<{ map: GeoreferencedMap; options: WarpedMapProps["options"] }>;
  /** Optional caller revision for inputs beyond the serialized geometry/options. */
  revision?: string;
};
export type RenderJob = {
  id: string;
  layers: string[];
  camera: Camera;
  size: [number, number];
  format: "webp" | "jpg";
  styles?: { lower: StyleSpecification; upper: StyleSpecification };
};
/** JSON only: no Svelte components, callbacks, absolute asset paths or running app. */
export type RenderPlan = {
  version: 1;
  epoch: number;
  publicUrl?: string;
  assets: SourceAssets;
  layers: Record<string, RenderLayer>;
  jobs: RenderJob[];
  resources: Record<string, { base64: string; extension: "json" }>;
};
export type RenderImage = { path: string; width: number; height: number };
export type RenderResult = {
  images: Record<string, RenderImage>;
  resources: Record<string, string>;
};
export type RenderOptions = {
  assetRoot: string;
  cacheRoot: string;
  outputRoot: string;
  offline?: boolean;
};
