export type MobilePanelSize = "collapsed" | "half" | "full";
export type MobilePanelHeights = Record<MobilePanelSize, number>;

const sizes: MobilePanelSize[] = ["collapsed", "half", "full"];

/** Snap long drags to the nearest stop; a short deliberate pull or flick
 * moves at least one stop in its direction. Positive velocity expands. */
export function snapMobilePanel(
  heights: MobilePanelHeights,
  start: MobilePanelSize,
  height: number,
  velocity = 0,
): MobilePanelSize {
  const distance = height - heights[start];
  const nearest = sizes.reduce((best, size) =>
    Math.abs(heights[size] - height) < Math.abs(heights[best] - height) ? size : best,
  );
  const direction = Math.abs(velocity) > 0.45 ? Math.sign(velocity) : Math.sign(distance);
  if (Math.abs(distance) < 40 && Math.abs(velocity) <= 0.45) return nearest;
  const adjacent = Math.max(0, Math.min(sizes.length - 1, sizes.indexOf(start) + direction));
  const target = direction > 0
    ? Math.max(adjacent, sizes.indexOf(nearest))
    : Math.min(adjacent, sizes.indexOf(nearest));
  return sizes[target];
}
