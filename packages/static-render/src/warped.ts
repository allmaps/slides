import { Viewport, type WarpedMap } from "@allmaps/render";
import { IntArrayRenderer } from "@allmaps/render/intarray";
import { lonLatToWebMercator } from "@allmaps/project";
import sharp from "sharp";
import { unitsPerPixel, type Camera } from "./camera.ts";
import { digest, type RenderCache } from "./cache.ts";
import type { Sources } from "./sources.ts";
import { StaticWarpedMap } from "./static-warped-map.ts";
import { applyMapEffects } from "./map-effects.ts";
import type { WarpedMapEffects } from "./map-options.ts";
export { StaticWarpedMap } from "./static-warped-map.ts";
export { staticMapOptions } from "./map-options.ts";
export type LoadedLayer = {
  effects?: WarpedMapEffects;
  mapEffects?: WarpedMapEffects[];
  maps: WarpedMap[];
  revision: string;
};
type DecodedImage = { pixels: Buffer; width: number; height: number };

export async function renderWarpedLayer(
  layer: LoadedLayer,
  camera: Camera,
  size: [number, number],
  sources: Sources,
  cache: RenderCache,
) {
  return cache.get(
    {
      version: 3,
      renderer: "intarray-beta84",
      layer: layer.revision,
      effects: layer.effects,
      mapEffects: layer.mapEffects,
      camera,
      size,
    },
    async () => {
      const inputs: Buffer[] = [];
      for (const [index, map] of layer.maps.entries()) {
        const effects = { ...map.mapOptions, ...layer.effects, ...layer.mapEffects?.[index] };
        if (effects.visible === false || effects.renderMaps === false || effects.opacity === 0) continue;
        const decoded = new Map<string, DecodedImage>();
        const failures: string[] = [];
        const fetchFn: typeof fetch = async (input) => {
          const url = input instanceof Request ? input.url : String(input);
          try {
            const source = await sources.get(url);
            if (!url.endsWith("info.json")) {
              const { data, info } = await sharp(source.bytes)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });
              decoded.set(source.hash, {
                pixels: data,
                width: info.width,
                height: info.height,
              });
            }
            return new Response(new Uint8Array(source.bytes), {
              headers: { "content-type": source.type },
            });
          } catch (error) {
            failures.push(String(error));
            throw error;
          }
        };
        const renderer = new IntArrayRenderer<DecodedImage>(
          (bytes) => {
            const result = decoded.get(
              digest(
                new Uint8Array(
                  bytes.buffer,
                  bytes.byteOffset,
                  bytes.byteLength,
                ),
              ),
            );
            if (!result) throw new Error("Tile was not decoded");
            return result;
          },
          (image, index) => image.pixels[index],
          (image) => [image.width, image.height],
          {
            fetchFn,
            overviewTilesMaxResolution: 0,
            warpedMapFactory: (...args) => new StaticWarpedMap(...args),
          },
        );
        try {
          renderer.addGeoreferencedMap(map.georeferencedMap, map.mapOptions);
          const viewport = new Viewport(
            size,
            lonLatToWebMercator(camera.center),
            unitsPerPixel(camera.zoom),
            {
              rotation: (-camera.bearing * Math.PI) / 180,
              devicePixelRatio: 1,
            },
          );
          const rgba = await renderer.render(viewport);
          if (failures.length) throw new Error(failures.join("\n"));
          await applyMapEffects(rgba, effects, map.georeferencedMap.resource.id);
          const output = sharp(Buffer.from(rgba), {
            raw: { width: size[0], height: size[1], channels: 4 },
          });
          inputs.push(await output.png().toBuffer());
        } finally {
          renderer.destroy();
          decoded.clear();
          sources.clearDecodedSources();
        }
      }
      return sharp({
        create: {
          width: size[0],
          height: size[1],
          channels: 4,
          background: "#00000000",
        },
      })
        .composite(inputs.map((input) => ({ input })))
        .png()
        .toBuffer();
    },
  );
}
