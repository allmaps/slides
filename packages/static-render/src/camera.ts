/** MapLibre uses a 512-pixel world tile at zoom zero. */
export const unitsPerPixel = (zoom: number) => 40075016.68557849 / (512 * 2 ** zoom);
export type Camera = { center: [number, number]; zoom: number; bearing: number };
