import { computeWarpedMapBearing } from "@allmaps/bearing";
import { webMercatorToLonLat } from "@allmaps/project";
import { computeRotatedBboxProperties } from "@allmaps/stdlib";
import type { WarpedMap } from "@allmaps/render";
import type { PaddingOptions, PointLike } from "maplibre-gl";
import type { MapChapterProps, WarpedMapProps } from "../types.ts";

export const WORLD_WIDTH = 40075016.68557849;
export const TILE_SIZE = 512;
export type Camera = {
  center: [number, number];
  zoom: number;
  bearing: number;
};
export type CameraLayoutOptions = {
  padding: number | PaddingOptions;
  offset?: PointLike;
};
export const unitsPerPixel = (zoom: number) =>
  WORLD_WIDTH / (TILE_SIZE * 2 ** zoom);

export function getCameraLayoutOptions(
  padding: number | PaddingOptions,
): CameraLayoutOptions {
  if (typeof padding === "number") return { padding };
  const { top = 25, right = 25, bottom = 25, left = 25 } = padding;
  return {
    padding: {
      top: (top + bottom) / 2,
      bottom: (top + bottom) / 2,
      left: (left + right) / 2,
      right: (left + right) / 2,
    },
    offset: [(left - right) / 2, (top - bottom) / 2],
  };
}

export function selectBoundsAnnotations(annotations: WarpedMapProps[]) {
  const selected = annotations.filter((annotation) => annotation.useBounds);
  return selected.length ? selected : annotations;
}

/** Shared by the live map and static previews; no MapLibre Map or DOM needed. */
export function resolveChapterCamera(
  chapter: MapChapterProps,
  getMaps: (annotation: WarpedMapProps) => WarpedMap[],
  size: [number, number],
  padding: number | PaddingOptions = 25,
  previous: Camera = { center: [0, 0], zoom: 14, bearing: 0 },
): Camera {
  const annotations = chapter.warpedMaps ?? [];
  const maps = selectBoundsAnnotations(annotations).flatMap(getMaps);
  const bearingMap = annotations.find((annotation) => annotation.useBearing);
  const bearingSource = bearingMap && getMaps(bearingMap)[0];
  const location = chapter.location ?? {};
  const bearing =
    location.bearing ??
    (bearingSource
      ? computeWarpedMapBearing(bearingSource)
      : maps.length
        ? 0
        : previous.bearing);
  let camera = { ...previous, bearing };
  if (maps.length) {
    const { bbox, center } = computeRotatedBboxProperties(
      maps.map((map) => map.projectedGeoAppliedMask),
      (bearing * Math.PI) / 180,
    );
    const p =
      typeof padding === "number"
        ? { left: padding, right: padding, top: padding, bottom: padding }
        : padding;
    const width = Math.max(1, size[0] - (p.left ?? 25) - (p.right ?? 25));
    const height = Math.max(1, size[1] - (p.top ?? 25) - (p.bottom ?? 25));
    const scale = Math.max(
      (bbox[2] - bbox[0]) / width,
      (bbox[3] - bbox[1]) / height,
    );
    camera = {
      center: webMercatorToLonLat(center),
      bearing,
      zoom: Math.min(
        22,
        Math.max(0, Math.log2(WORLD_WIDTH / (TILE_SIZE * scale))),
      ),
    };
    const scales = annotations
      .filter((annotation) => annotation.useZoom)
      .flatMap(getMaps)
      .map((map) => map.resourceToProjectedGeoScale)
      .filter((scale) => scale > 0 && Number.isFinite(scale));
    if (scales.length)
      camera.zoom = Math.log2((Math.max(...scales) * WORLD_WIDTH) / TILE_SIZE);
  }
  return {
    center: location.center ?? camera.center,
    zoom: location.zoom ?? camera.zoom,
    bearing: location.bearing ?? camera.bearing,
  };
}
