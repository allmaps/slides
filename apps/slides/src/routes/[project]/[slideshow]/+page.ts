import { error } from "@sveltejs/kit";

import {
  getSlideshowByRoute,
  getSubslideshowRouteEntries,
} from "$lib/shared/projects";

export const entries = getSubslideshowRouteEntries;

export const load = ({ params }) => {
  if (!getSlideshowByRoute(params.project, params.slideshow)) {
    error(404, `Slideshow not found: ${params.project}/${params.slideshow}`);
  }

  return {
    project: params.project,
    slideshow: params.slideshow,
  };
};
