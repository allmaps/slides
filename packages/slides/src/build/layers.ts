import { parseAnnotation, type GeoreferencedMap } from "@allmaps/annotation";
import type { WarpedMap } from "@allmaps/render";
import { createFauxGeoreferencedMap } from "../model/map/image.ts";
import type { WarpedMapProps } from "../model/types.ts";
import { recipeHash, type RemoteCache, type CachedResource } from "@allmaps/static-render/cache";
import type { Sources } from "@allmaps/static-render/sources";
import { StaticWarpedMap } from "@allmaps/static-render/warped";
export type LoadedLayer = {
  props: WarpedMapProps;
  maps: WarpedMap[];
  effects: { opacity?: number; saturation?: number };
  revision: string;
  annotation?: CachedResource;
};

export async function loadLayer(
  props: WarpedMapProps,
  annotations: RemoteCache,
  sources: Sources,
): Promise<LoadedLayer> {
  const options = { ...props.options };
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
    effects: { opacity: options.opacity, saturation: options.saturation },
    maps: maps.map(
      (map, index) =>
        new StaticWarpedMap(`${recipeHash(map)}:${index}`, map, {}, options),
    ),
    revision: recipeHash({ maps, options, imageRevisions }),
  };
}

