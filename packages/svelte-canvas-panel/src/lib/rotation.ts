import type { ImageBox } from "./iiif-source.ts";

/** Rotate the complete canvas and keep its bounding box at the origin. */
export function canvasRotation(size: { width: number; height: number }, degrees = 0) {
  const rotation = Number.isFinite(degrees) ? ((degrees % 360) + 360) % 360 : 0;
  const radians = rotation * Math.PI / 180;
  const snap = (value: number) => Math.abs(value) < 1e-10 ? 0 : value;
  const cos = snap(Math.cos(radians));
  const sin = snap(Math.sin(radians));
  const dx = -Math.min(0, size.width * cos, -size.height * sin, size.width * cos - size.height * sin);
  const dy = -Math.min(0, size.width * sin, size.height * cos, size.width * sin + size.height * cos);
  const point = (x: number, y: number) => ({ x: x * cos - y * sin + dx, y: x * sin + y * cos + dy });
  const bounds = (box: ImageBox): ImageBox => {
    const points = [point(box.x, box.y), point(box.x + box.width, box.y),
      point(box.x, box.y + box.height), point(box.x + box.width, box.y + box.height)];
    const x = Math.min(...points.map(p => p.x));
    const y = Math.min(...points.map(p => p.y));
    return { x, y, width: Math.max(...points.map(p => p.x)) - x, height: Math.max(...points.map(p => p.y)) - y };
  };
  return {
    rotation,
    width: Math.abs(size.width * cos) + Math.abs(size.height * sin),
    height: Math.abs(size.width * sin) + Math.abs(size.height * cos),
    bounds,
    /** Atlas rotates each image about its own center; move that center first. */
    placement(box: ImageBox): ImageBox {
      const center = point(box.x + box.width / 2, box.y + box.height / 2);
      return { ...box, x: center.x - box.width / 2, y: center.y - box.height / 2 };
    },
    transform: `matrix(${cos} ${sin} ${-sin} ${cos} ${dx} ${dy})`,
  };
}
