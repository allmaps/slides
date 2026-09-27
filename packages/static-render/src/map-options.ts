import type { WarpedMapOptions } from "@allmaps/render";
import type { WebGL2RenderOptions, WebGL2WarpedMapOptions } from "@allmaps/render/webgl2";
import { isEqualProjection, webMercatorProjection } from "@allmaps/project";

const effectKeys = [
  "opacity", "saturation", "removeColor", "removeColorColor",
  "removeColorThreshold", "removeColorHardness", "colorize", "colorizeColor",
  "visible", "renderMaps",
] as const satisfies readonly (keyof WebGL2WarpedMapOptions)[];

export type WarpedMapEffects = Partial<Pick<WebGL2WarpedMapOptions, typeof effectKeys[number]>>;

const geometryKeys = [
  "gcps", "resourceMask", "transformationType", "internalProjection", "applyMask",
] as const satisfies readonly (keyof WarpedMapOptions)[];

// Live interaction, scheduling and cache controls have no effect on a finished
// still. The static renderer owns fetching, tile selection and failure handling.
const runtimeKeys = new Set<string>([
  "anticipateVisibility", "anticipateInteraction", "animatedOptions",
  "createRTree", "rtreeUpdatedOptions", "batchFailureMode",
  "overviewTilesSelection", "overviewTilesMaxResolution",
  "requestViewportBufferRatio", "overviewRequestViewportBufferRatio",
  "pruneViewportBufferRatio", "overviewPruneViewportBufferRatio",
  "maxTotalOverviewResolutionRatio", "spritesMaxHigherLog2ScaleFactorDiff",
  "spritesMaxLowerLog2ScaleFactorDiff", "layerId", "layerType", "layerRenderingMode",
]);

/** Keep unsupported WebGL settings out of the buffer renderer, including future options. */
export function staticMapOptions(input: Partial<WebGL2RenderOptions> = {}, label: string) {
  const options: Partial<WarpedMapOptions> = {};
  const effects: WarpedMapEffects = {};
  const unsupported: string[] = [];
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;
    if ((effectKeys as readonly string[]).includes(key)) {
      Object.assign(effects, { [key]: value });
    } else if ((geometryKeys as readonly string[]).includes(key)) {
      Object.assign(options, { [key]: value });
    } else if (key === "projection" && isEqualProjection(input.projection!, webMercatorProjection)) {
      // Viewports and basemaps use Web Mercator; it is already the default.
    } else if (!runtimeKeys.has(key) && value !== false) {
      unsupported.push(key);
    }
  }
  if (unsupported.length)
    console.warn(`[static-render] ${label}: unsupported map options ${unsupported.join(", ")}; generating preview without these options.`);
  return { options, effects };
}
