import { project as metadata } from "$lib/shared/content-package";
import { slideFiles, creditsFiles, sharedCreditsFile } from "virtual:slides/markdown";
import { withBaseUrl } from "$lib/shared/paths";
import type { MapChapter, Slideshow, Project } from "$lib/shared/types";
const project: Project = {
  ...metadata,
  CreditsComponent: sharedCreditsFile,
  slideshows: metadata.slideshows.map((show) => ({
    ...show,
    CreditsComponent: creditsFiles[show.id],
    chapters: show.chapters.map((chapter) => ({
      ...chapter,
      Component: slideFiles[chapter.sourcePath].default,
    })),
  })),
};

export const getProject = () => project;

export const getMainSlideshow = () =>
  project.slideshows.find((candidate) => candidate.id === project.main);

export const getSlideshowByRoute = (slideshowSlug?: string) =>
  slideshowSlug
    ? project.slideshows.find((candidate) => candidate.slug === slideshowSlug)
    : getMainSlideshow();

export const getSlideshowRouteHref = (slideshow: Slideshow) =>
  withBaseUrl(slideshow.slug);

export const getChapterAnchorHref = (slideshow: Slideshow, chapter: MapChapter) =>
  `${getSlideshowRouteHref(slideshow)}#${encodeURIComponent(chapter.slug)}`;

export const getChapterRouteHref = (
  slideshow: Slideshow,
  chapter: MapChapter,
) => {
  const slideshowHref = getSlideshowRouteHref(slideshow);

  return slideshow.chapters[0]?.slug === chapter.slug
    ? slideshowHref
    : getChapterAnchorHref(slideshow, chapter);
};

export const getSlideshowRouteEntries = () =>
  project.slideshows
    .filter((slideshow) => slideshow.id !== project.main && slideshow.slug)
    .map((slideshow) => ({ slideshow: slideshow.slug }));
