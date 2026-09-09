import type { SourceSpecification } from "maplibre-gl";

import { slidesConfig } from "$lib/shared/app-config";
import { slideFiles } from "$lib/shared/content-package";
import {
  parseSlideMetadata,
  type ParsedSlideMetadata,
} from "$lib/shared/content-schema";
import { getContentAssetUrl, withBaseUrl } from "$lib/shared/paths";
import type {
  MapChapter,
  Project,
  Slideshow,
  SlideshowDefinition,
  SourceDefinition,
} from "$lib/shared/types";

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

const resolveWarpedMaps = (metadata: ParsedSlideMetadata) => {
  if (!metadata.warpedMaps) return metadata;

  return {
    ...metadata,
    warpedMaps: metadata.warpedMaps.map((warpedMap) => ({
      ...warpedMap,
      url: getContentAssetUrl(warpedMap.url) ?? warpedMap.url,
    })),
  };
};

const createSource = (source: SourceDefinition): SourceSpecification => {
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

const buildProject = (): Project => {
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
      Component: mod.default,
      ...resolveWarpedMaps(result.data),
    });

    slidesBySlideshow.set(slideshowPath, slides);
  }

  const sources = Object.fromEntries(
    Object.entries(slidesConfig.sources).map(([sourceId, source]) => [
      sourceId,
      createSource(source),
    ]),
  );
  const slideshows: Slideshow[] = slidesConfig.slideshows.map((rawSlideshow) => {
    const slideshow = normalizeSlideshow(rawSlideshow, slidesConfig.main);

    return {
      ...slideshow,
      title: slideshow.title ?? slidesConfig.title,
      chapters: slidesBySlideshow.get(slideshow.path) ?? [],
      sources,
    };
  });

  return {
    title: slidesConfig.title,
    description: slidesConfig.description,
    main: slidesConfig.main,
    sources,
    slideshows,
  };
};

const project = buildProject();

export const getProject = () => project;

export const getMainSlideshow = () =>
  project.slideshows.find((candidate) => candidate.id === project.main);

export const getSlideshowByRoute = (slideshowSlug?: string) =>
  slideshowSlug
    ? project.slideshows.find((candidate) => candidate.slug === slideshowSlug)
    : getMainSlideshow();

export const getSlideshowRouteHref = (slideshow: Slideshow) =>
  withBaseUrl(slideshow.slug);

export const getChapterRouteHref = (
  slideshow: Slideshow,
  chapter: MapChapter,
) => {
  const slideshowHref = getSlideshowRouteHref(slideshow);

  return slideshow.chapters[0]?.slug === chapter.slug
    ? slideshowHref
    : `${slideshowHref}#${encodeURIComponent(chapter.slug)}`;
};

export const getSlideshowRouteEntries = () =>
  project.slideshows
    .filter((slideshow) => slideshow.id !== project.main && slideshow.slug)
    .map((slideshow) => ({ slideshow: slideshow.slug }));
