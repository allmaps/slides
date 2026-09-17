import type { LayerSpecification } from "maplibre-gl";
import type { MapLayerProps } from "../types.ts";
import { LAYER_TYPES } from "../settings.ts";

/** Keep authored layer IDs/order consistent between MapLibre and static scenes. */
export const prepareUserLayers = (layers: LayerSpecification[]) =>
  layers.map((layer) => ({ ...layer, id: `user-${layer.id}` })).reverse();

export function getUserLayerChange(change: MapLayerProps, type: string) {
  const properties = LAYER_TYPES[type as keyof typeof LAYER_TYPES] ?? [];
  return {
    id: `user-${change.layer}`,
    visibility: change.visibility,
    duration: change.duration,
    paint:
      change.opacity === undefined
        ? {}
        : Object.fromEntries(
            properties.map((property) => [property, change.opacity!]),
          ),
  };
}

export function applyUserLayerChanges(
  layers: LayerSpecification[],
  changes: MapLayerProps[] = [],
) {
  return layers.map((layer) => {
    const change = changes.find(
      (change) => `user-${change.layer}` === layer.id,
    );
    if (!change) return layer;
    const { visibility, paint } = getUserLayerChange(change, layer.type);
    return {
      ...layer,
      ...(visibility ? { layout: { ...layer.layout, visibility } } : {}),
      paint: { ...layer.paint, ...paint },
    } as LayerSpecification;
  });
}
