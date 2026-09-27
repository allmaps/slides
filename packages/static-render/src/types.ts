import type { GeoreferencedMap } from "@allmaps/annotation";
import type { StyleSpecification } from "maplibre-gl";
import type { WebGL2RenderOptions } from "@allmaps/render/webgl2";
import type { WarpedMapEffects } from "./map-options.ts";
export type { WarpedMapEffects } from "./map-options.ts";
import type { Camera } from "./camera.ts";
import type { SourceAssets } from "./sources.ts";

export type RenderLayer = {
  effects?: WarpedMapEffects;
  maps: Array<{ map: GeoreferencedMap; options?: Partial<WebGL2RenderOptions> }>;
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
  /** Optional bottom-aligned title/subtitle with a soft contrast halo. */
  textOverlay?: {
    title: string;
    subtitle?: string;
    font?: string;
    /** Title size at 1200 × 630, in pixels (default: 76); subtitle scales proportionally. */
    textSize?: number;
  };
};
/** JSON only: no Svelte components, callbacks, absolute asset paths or running app. */
export type RenderPlan = {
  version: 2;
  epoch: number;
  /** Require fresh sources even when a previous snapshot exists. */
  refresh?: boolean;
  publicUrl?: string;
  assets: SourceAssets;
  layers: Record<string, RenderLayer>;
  jobs: RenderJob[];
  resources: Record<string, { base64: string; extension: "json" }>;
  /** Caller-supplied fonts; omitted base64 uses an installed font family. */
  fonts?: Record<string, { family: string; base64?: string }>;
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
