import { error } from "@sveltejs/kit";

import {
  getMainRouteEntries,
  getRootSlideshowByRoute,
  getSlideshowByRoute,
  isSingleProjectRootMode,
} from "$lib/shared/projects";

export const entries = getMainRouteEntries;

export const load = ({ params }) => {
  const rootRoute = getRootSlideshowByRoute(params.project);

  if (rootRoute) {
    return {
      project: rootRoute.project.slug,
      slideshow: rootRoute.slideshow.slug,
    };
  }

  if (isSingleProjectRootMode()) {
    error(404, `Slideshow not found: ${params.project}`);
  }

  if (!getSlideshowByRoute(params.project)) {
    error(404, `Project not found: ${params.project}`);
  }

  return {
    project: params.project,
  };
};
