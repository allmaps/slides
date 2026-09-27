import maplibregl, { type TransformConstrainFunction } from "maplibre-gl";

// Keep the camera center projectable, but let the viewport extend past the world.
// Otherwise MapLibre changes overview framing to keep the world's edges off screen,
// fighting the panel offset and zoom during flyTo.
export const constrainSlideshowCamera: TransformConstrainFunction = (center, zoom) => ({
  center: new maplibregl.LngLat(
    center.lng,
    Math.max(-85.051129, Math.min(85.051129, center.lat)),
  ),
  zoom: Math.max(-2, Math.min(22, zoom)),
});
