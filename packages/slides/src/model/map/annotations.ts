import type { MapChapterProps, ThemeMode, WarpedMapProps } from "../types.ts";
import type { MapLibreWarpedMapLayerOptions } from "@allmaps/maplibre";
import { DEFAULT_WARPED_MAP_OPTIONS } from "../settings.ts";

export const getWarpedMapOptions = (map: WarpedMapProps, theme: ThemeMode = "light"): Partial<MapLibreWarpedMapLayerOptions> => ({
  ...DEFAULT_WARPED_MAP_OPTIONS,
  ...map.options,
  ...(theme === "dark" ? map.darkOptions : {}),
});

export const getUniqueAnnotations = (annotations: WarpedMapProps[]) => {
  const unique = new Map<string, WarpedMapProps>();
  for (const annotation of annotations)
    if (!unique.has(annotation.url)) unique.set(annotation.url, annotation);
  return [...unique.values()];
};

export const getAnnotationsFromChapters = (chapters: MapChapterProps[]) =>
  getUniqueAnnotations(chapters.flatMap((chapter) => chapter.warpedMaps ?? []));

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_, entry) =>
    entry && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(
          Object.entries(entry).sort(([a], [b]) => a.localeCompare(b)),
        )
      : entry,
  );
}

/** URL stays the authored identity; variants include transformation/effects. */
export const layerPreviewKey = ({
  url,
  options,
  darkOptions,
}: WarpedMapProps, theme: ThemeMode = "light") => stableStringify({
  url,
  options: theme === "dark" && darkOptions ? { ...options, ...darkOptions } : options,
});
