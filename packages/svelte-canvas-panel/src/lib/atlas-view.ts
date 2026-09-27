import type { IiifResource, ImageBox } from "./iiif-resource.ts";

/** Source pixels per canvas unit, including images painted at a different size. */
export function nativeImageScale(resource: IiifResource) {
  return Math.min(...resource.images.map(image =>
    Math.min(image.width / image.target.width, image.height / image.target.height),
  ));
}

export function fitImageRegion(region: ImageBox, width: number, height: number, maxScale = Infinity): ImageBox {
  const scale = Math.min(width / region.width, height / region.height, maxScale);
  return {
    x: region.x - (width / scale - region.width) / 2,
    y: region.y - (height / scale - region.height) / 2,
    width: width / scale, height: height / scale,
  };
}

export type ImageZoomState = { canZoomIn: boolean; canZoomOut: boolean };

export function imageZoomState(scale: number, minScale: number, maxScale: number): ImageZoomState {
  // Atlas stores coordinates in Float32 arrays; tolerate rounding at the limits.
  return { canZoomIn: scale < maxScale * 0.999, canZoomOut: scale > minScale * 1.001 };
}

/** Keep the existing canvas while a resize gesture is still changing its size. */
export function settledResize(resize: () => void, delay = 200) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = () => { clearTimeout(timer); timer = undefined; };
  return {
    schedule() { cancel(); timer = setTimeout(() => { timer = undefined; resize(); }, delay); },
    flush() { cancel(); resize(); },
    cancel,
  };
}
