import type { LayerSpecification, SourceSpecification, StyleSpecification } from "maplibre-gl";
import { getLayerWithVisibility, type EffectiveBasemapLayerState, type ResolvedBasemapStyle } from "../model/basemap.ts";
export function sceneStyles(
  style: ResolvedBasemapStyle,
  state: EffectiveBasemapLayerState,
  hidden: boolean,
  sources: Record<string, SourceSpecification>,
  overlays: LayerSpecification[],
) {
  const lower: LayerSpecification[] = style.baseLayers.map((layer) =>
    getLayerWithVisibility(style, layer, false, state, hidden),
  );
  const upper: LayerSpecification[] = [];
  for (const layer of style.labelLayers) {
    (state.labels.position === "aboveWarpedMaps" ? upper : lower).push(
      getLayerWithVisibility(style, layer, true, state, hidden),
    );
  }
  if (hidden)
    lower.push({
      id: "thumbnail-background",
      type: "background",
      paint: { "background-color": style.foregroundColor },
    });
  upper.push(...overlays);
  const make = (layers: LayerSpecification[]): StyleSpecification => ({
    version: 8,
    sources: { ...style.sources, ...sources },
    glyphs: style.glyphs,
    sprite: style.sprite,
    layers: layers.filter((layer) => layer.layout?.visibility !== "none"),
  });
  return { lower: make(lower), upper: make(upper) };
}

