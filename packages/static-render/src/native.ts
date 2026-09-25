import type { Camera } from "./camera.ts";
import type { GeoJSONSourceSpecification, StyleSpecification } from "maplibre-gl";
import type { Sources } from "./sources.ts";

type GeoJson = Exclude<GeoJSONSourceSpecification["data"], string>;

function normalizeGeoJson(data: GeoJson): GeoJson {
  if (data.type === "FeatureCollection")
    return { ...data, features: data.features.map(feature => {
      if (feature.id !== null) return feature;
      const { id, ...withoutId } = feature;
      return withoutId;
    }) };
  if (data.type === "Feature" && data.id === null) {
    const { id, ...withoutId } = data;
    return withoutId;
  }
  return data;
}

/** Native silently omits features with null IDs; treat those as absent like GL JS. */
export function normalizeGeoJsonSources(style: StyleSpecification): StyleSpecification {
  return {
    ...style,
    sources: Object.fromEntries(Object.entries(style.sources).map(([id, source]) => [
      id,
      source.type === "geojson" && typeof source.data === "object"
        ? { ...source, data: normalizeGeoJson(source.data) }
        : source,
    ])),
  };
}

/** Call from the renderer CLI's main thread, outside SvelteKit/Vite workers. */
export class NativeRenderer {
  private sources: Sources;
  private cacheDir: string;
  constructor(sources: Sources, cacheDir: string) {
    this.sources = sources;
    this.cacheDir = cacheDir;
  }
  async render(
    style: StyleSpecification,
    camera: Camera,
    size: [number, number],
  ): Promise<Buffer> {
    const { getRenderedCameraBuffer, ChiitilerCache } = await import("chiitiler");
    const fallback = ChiitilerCache.fileCache({ dir: this.cacheDir, ttl: 0 });
    return getRenderedCameraBuffer({
      stylejson: normalizeGeoJsonSources(style) as Parameters<
        typeof getRenderedCameraBuffer
      >[0]["stylejson"],
      ...camera,
      width: size[0],
      height: size[1],
      pitch: 0,
      ext: "png",
      quality: 100,
      cache: {
        name: "slides",
        get: async (key: string) => {
          if (/^https?:\/\//.test(key))
            return (await this.sources.get(key)).bytes;
          const bytes = await fallback.get(key);
          if (!bytes && this.sources.remote.options.offline)
            throw new Error(`Offline native source cache miss: ${key}`);
          return bytes;
        },
        set: fallback.set,
      },
    });
  }
}
