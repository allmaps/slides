import type { StyleSpecification } from "maplibre-gl";
import type { Camera } from "./camera.ts";
import type { RenderCache } from "./cache.ts";
import type { NativeRenderer } from "./native.ts";
export async function renderBasemap(
  style: StyleSpecification,
  camera: Camera,
  size: [number, number],
  native: NativeRenderer,
  cache: RenderCache,
  epoch: number,
) {
  return cache.get(
    { version: 1, renderer: "chiitiler-1.24.2", style, camera, size, epoch },
    () => native.render(style, camera, size),
  );
}
