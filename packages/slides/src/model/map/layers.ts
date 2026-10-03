import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import type { MapLayerProps, UserLayerConfig } from "../types.ts";
import { DEFAULT_GLYPHS, LAYER_TYPES } from "../settings.ts";
import { getGeoJsonLayers } from "../geojson.ts";

export const getUserLayerGlyphs = (layers: LayerSpecification[]) =>
  layers.some(layer => layer.type === "symbol" && layer.layout?.["text-field"])
    ? DEFAULT_GLYPHS : undefined;

/** Keep authored layer IDs/order consistent between MapLibre and static scenes. */
export const prepareUserLayers = (layers: LayerSpecification[]) =>
  layers.map((layer) => ({ ...layer, id: `user-${layer.id}` }));

/** Generated layers first, custom layers above them, in authored drawing order. */
export function resolveUserLayers(
  sources: Record<string, SourceSpecification>,
  config: UserLayerConfig[] = [],
): LayerSpecification[] {
  const layers = new Map(Object.entries(sources).flatMap(([id, source]) =>
    source.type === "geojson" ? getGeoJsonLayers(id).map(layer => [layer.id, layer] as const) : [],
  ) as [string, LayerSpecification][]);
  const customIds = new Set<string>();
  const defaults: MapLayerProps[] = [];
  for (const entry of config) {
    if ("id" in entry) {
      if (customIds.has(entry.id)) throw new Error(`Duplicate layer id: ${entry.id}`);
      customIds.add(entry.id);
      if ("source" in entry && !sources[entry.source])
        throw new Error(`Unknown source ${entry.source} for layer ${entry.id}`);
      layers.delete(entry.id);
      layers.set(entry.id, entry);
    } else {
      defaults.push(entry);
    }
  }
  const prepared = prepareUserLayers([...layers.values()]);
  validateUserLayerChanges(prepared, defaults, "global layers");
  return applyUserLayerChanges(prepared, defaults);
}

export function validateUserLayerChanges(layers: LayerSpecification[], changes: MapLayerProps[] = [], context: string) {
  const ids = new Set(layers.map(layer => layer.id));
  const seen = new Set<string>();
  for (const change of changes) {
    if (!ids.has(`user-${change.layer}`)) throw new Error(`Unknown layer ${change.layer} in ${context}`);
    if (seen.has(change.layer)) throw new Error(`Duplicate layer ${change.layer} in ${context}`);
    seen.add(change.layer);
  }
}

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
    const transitions = change.duration === undefined ? {} : Object.fromEntries(
      (LAYER_TYPES[layer.type as keyof typeof LAYER_TYPES] ?? [])
        .map(property => [`${property}-transition`, { duration: change.duration }]),
    );
    return {
      ...layer,
      ...(visibility ? { layout: { ...layer.layout, visibility } } : {}),
      paint: { ...layer.paint, ...paint, ...transitions },
    } as LayerSpecification;
  });
}
