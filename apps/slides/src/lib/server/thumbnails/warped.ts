import { parseAnnotation, type GeoreferencedMap } from "@allmaps/annotation";
import { Viewport, WarpedMap } from "@allmaps/render";
import { IntArrayRenderer } from "@allmaps/render/intarray";
import { lonLatToWebMercator } from "@allmaps/project";
import sharp from "sharp";
import { createFauxGeoreferencedMap } from "$lib/shared/map/image";
import { unitsPerPixel, type Camera } from "$lib/shared/map/camera";
import type { WarpedMapProps } from "$lib/shared/types";
import {
  digest,
  recipeHash,
  type RemoteCache,
  type CachedResource,
  type RenderCache,
} from "./cache.ts";
import type { Sources } from "./sources.ts";

export type LoadedLayer = {
  props: WarpedMapProps;
  maps: WarpedMap[];
  revision: string;
  annotation?: CachedResource;
};

export async function loadLayer(
  props: WarpedMapProps,
  annotations: RemoteCache,
  sources: Sources,
): Promise<LoadedLayer> {
  const options = { ...props.options };
  // IntArrayRenderer fits the backward transform independently. For projective
  // maps this can differ substantially from the forward transform used to fit
  // the camera. Use first-order polynomial geometry throughout the preview.
  if (options.transformationType === "projective")
    options.transformationType = "polynomial";
  const unsupported = [
    "removeColor",
    "colorize",
    "distortionMeasure",
    "renderMask",
    "renderFullMask",
    "renderGcps",
    "renderTransformedGcps",
    "renderVectors",
    "renderGrid",
  ];
  for (const key of unsupported)
    if ((options as Record<string, unknown>)[key])
      throw new Error(
        `Thumbnail effect '${key}' is not supported for ${props.url}`,
      );
  let annotation: CachedResource | undefined;
  let maps: GeoreferencedMap[];
  if (props.type === "Image")
    maps = [
      await createFauxGeoreferencedMap(props.url, {
        ...props,
        fetchFn: sources.fetch,
      }),
    ];
  else {
    annotation = await (/^https?:\/\//.test(props.url)
      ? annotations.get(props.url)
      : sources.get(props.url));
    maps = parseAnnotation(JSON.parse(annotation.bytes.toString()));
  }
  if (!maps.length) throw new Error(`No georeferenced maps: ${props.url}`);
  maps = maps.map((map) =>
    map.transformation?.type === "projective"
      ? { ...map, transformation: { type: "polynomial" } }
      : map,
  );
  const imageRevisions = await Promise.all(
    maps.map((map) => sources.imageRevision(map.resource.id)),
  );
  // The buffer renderer reads resourceMask directly, so normalize unmasked maps.
  if (options.applyMask === false)
    maps = maps.map((map) => {
      const { width, height } = map.resource;
      if (!width || !height)
        throw new Error(`Unmasked thumbnail needs dimensions: ${props.url}`);
      return {
        ...map,
        resourceMask: [
          [0, 0],
          [width, 0],
          [width, height],
          [0, height],
        ],
      };
    });
  return {
    props,
    annotation,
    maps: maps.map(
      (map, index) =>
        new WarpedMap(`${recipeHash(map)}:${index}`, map, {}, options),
    ),
    revision: recipeHash({ maps, options, imageRevisions }),
  };
}

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
      version: 1,
      renderer: "intarray-beta83",
      layer: layer.revision,
      camera,
      size,
    },
    async () => {
      const inputs: Buffer[] = [];
      for (const map of layer.maps) {
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
          { fetchFn, overviewTilesMaxResolution: 0 },
        );
        try {
          renderer.addGeoreferencedMap(
            map.georeferencedMap,
            map.mapOptions,
          );
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
          const opacity = layer.props.options?.opacity ?? 1;
          for (let i = 3; i < rgba.length; i += 4)
            rgba[i] = Math.round(rgba[i] * opacity);
          let output = sharp(Buffer.from(rgba), {
            raw: { width: size[0], height: size[1], channels: 4 },
          });
          if (layer.props.options?.saturation !== undefined)
            output = output.modulate({
              saturation: layer.props.options.saturation,
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
