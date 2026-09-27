import { parseAnnotation, type GeoreferencedMap } from "@allmaps/annotation";
import type { WarpedMap } from "@allmaps/render";
import { createFauxGeoreferencedMap } from "../model/map/image.ts";
import type { WarpedMapProps } from "../model/types.ts";
import { recipeHash, type RemoteCache, type CachedResource } from "@allmaps/static-render/cache";
import type { Sources } from "@allmaps/static-render/sources";
import { StaticWarpedMap, staticMapOptions } from "@allmaps/static-render/warped";
import type { WarpedMapEffects } from "@allmaps/static-render/types";
export type LoadedLayer = {
  props: WarpedMapProps;
  maps: WarpedMap[];
  effects: WarpedMapEffects;
  revision: string;
  annotation?: CachedResource;
};

export async function loadLayer(
  props: WarpedMapProps,
  annotations: RemoteCache,
  sources: Sources,
): Promise<LoadedLayer> {
  const { options, effects } = staticMapOptions(props.options, props.url);
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
  return {
    props,
    annotation,
    effects,
    maps: maps.map(
      (map, index) =>
        new StaticWarpedMap(`${recipeHash(map)}:${index}`, map, {}, options),
    ),
    revision: recipeHash({ maps, options, effects, imageRevisions }),
  };
}
