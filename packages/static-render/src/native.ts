import type { Camera } from "./camera.ts";
import type { StyleSpecification } from "maplibre-gl";
import type { Sources } from "./sources.ts";

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
      stylejson: style as Parameters<
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
