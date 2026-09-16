import type { MapChapterProps, WarpedMapProps } from "../types.ts";

export const getUniqueAnnotations = (annotations: WarpedMapProps[]) => {
  const unique = new Map<string, WarpedMapProps>();
  for (const annotation of annotations)
    if (!unique.has(annotation.url)) unique.set(annotation.url, annotation);
  return [...unique.values()];
};

export const getAnnotationsFromChapters = (chapters: MapChapterProps[]) =>
  getUniqueAnnotations(chapters.flatMap((chapter) => chapter.warpedMaps ?? []));

export const hidesBasemap = (chapter: MapChapterProps) =>
  !!(
    chapter.hideBasemap ||
    chapter.warpedMaps?.some((map) => map.type === "Image")
  );

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)),
        )
      : entry,
  );
}

/** URL stays the authored identity; variants include crop/transformation/effects. */
export const layerPreviewKey = ({
  url,
  type,
  region,
  wiggle,
  options,
}: WarpedMapProps) => stableStringify({ url, type, region, wiggle, options });
