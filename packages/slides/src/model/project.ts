import type { SourceSpecification } from "maplibre-gl";
import { parseSlideMetadata } from "./content-schema.ts";
import type {
  SlidesConfig,
  MapChapter,
  MapChapterProps,
  Project,
  Slideshow,
  SlideshowDefinition,
  SourceDefinition,
} from "./types.ts";

const getSlideParts = (path: string) => {
  const parts = path.replace(/\\/g, "/").replace(/^\.\//, "").split("/");
  const filename = parts.at(-1)?.replace(/\.md$/, "");

  if (!filename || parts.length < 2) {
    throw new Error(`Could not infer slide path from ${path}`);
  }

  return {
    slideshowPath: parts.slice(0, -1).join("/"),
    filename,
  };
};

const getSlideSlug = (filename: string) =>
  filename.replace(/^\d+[-_]/, "").replace(/\.md$/, "");

const normalizeSlideshow = (
  slideshow: SlideshowDefinition,
  mainSlideshowId: string,
): SlideshowDefinition & { slug: string } => ({
  ...slideshow,
  slug:
    slideshow.id === mainSlideshowId ? "" : (slideshow.slug ?? slideshow.id),
});

const resolveWarpedMaps = <Metadata extends MapChapterProps>(
  metadata: Metadata,
  getContentAssetUrl: (path: string) => string | undefined,
): Metadata => {
  if (!metadata.warpedMaps) return metadata;

  return {
    ...metadata,
    warpedMaps: metadata.warpedMaps.map((warpedMap) => ({
      ...warpedMap,
      url: getContentAssetUrl(warpedMap.url) ?? warpedMap.url,
    })),
  } as Metadata;
};

const createSource = (
  source: SourceDefinition,
  getContentAssetUrl: (path: string) => string | undefined,
): SourceSpecification => {
  const sourceUrl = (source.path ?? source.url) as string;

  if (source.type === "geojson") {
    return {
      type: "geojson",
      data: getContentAssetUrl(sourceUrl) ?? sourceUrl,
    };
  }

  return {
    ...source,
    url: getContentAssetUrl(sourceUrl) ?? sourceUrl,
  } as SourceSpecification;
};

export const buildProject = (
  slidesConfig: SlidesConfig,
  slideFiles: Record<string, { metadata: unknown }>,
  getContentAssetUrl: (path: string) => string | undefined = () => undefined,
): Project => {
  const slidesBySlideshow = new Map<string, MapChapter[]>();

  for (const [path, mod] of Object.entries(slideFiles).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const { slideshowPath, filename } = getSlideParts(path);
    const result = parseSlideMetadata(mod.metadata, path);

    if (!result.success) continue;

    const slides = slidesBySlideshow.get(slideshowPath) ?? [];

    slides.push({
      slug: getSlideSlug(filename),
      ...resolveWarpedMaps(result.data, getContentAssetUrl),
      sourcePath: path,
    });

    slidesBySlideshow.set(slideshowPath, slides);
  }

  const sources = Object.fromEntries(
    Object.entries(slidesConfig.sources).map(([sourceId, source]) => [
      sourceId,
      createSource(source, getContentAssetUrl),
    ]),
  );
  const slideshows: Slideshow[] = slidesConfig.slideshows.map(
    (rawSlideshow) => {
      const slideshow = normalizeSlideshow(rawSlideshow, slidesConfig.main);

      return {
        ...slideshow,
        title: slideshow.title ?? slidesConfig.title,
        start: slideshow.start
          ? resolveWarpedMaps(slideshow.start, getContentAssetUrl)
          : undefined,
        chapters: slidesBySlideshow.get(slideshow.path) ?? [],
        sources,
      };
    },
  );

  validateProjectReferences(slideshows, slidesConfig.main);
  return {
    title: slidesConfig.title,
    description: slidesConfig.description,
    main: slidesConfig.main,
    interface: slidesConfig.interface,
    credits: slidesConfig.credits,
    sources,
    slideshows,
  };
};

export function validateProjectReferences(
  slideshows: Slideshow[],
  main: string,
) {
  const ids = new Set<string>(),
    slugs = new Set<string>();
  for (const show of slideshows) {
    if (ids.has(show.id)) throw new Error(`Duplicate slideshow id: ${show.id}`);
    if (slugs.has(show.slug))
      throw new Error(`Duplicate slideshow route: ${show.slug}`);
    ids.add(show.id);
    slugs.add(show.slug);
    const chapters = new Set<string>();
    for (const chapter of show.chapters) {
      if (chapters.has(chapter.slug))
        throw new Error(`Duplicate slide slug in ${show.id}: ${chapter.slug}`);
      chapters.add(chapter.slug);
    }
  }
  if (slideshows.length && !ids.has(main))
    throw new Error(`Unknown main slideshow: ${main}`);
  for (const show of slideshows)
    for (const chapter of show.chapters) {
      for (const ref of chapter.subslideshows ?? []) {
        const id = typeof ref === "string" ? ref : ref.id;
        if (!ids.has(id))
          throw new Error(
            `Unknown subslideshow ${id} in ${show.id}/${chapter.slug}`,
          );
      }
    }
}
