import { error } from "@sveltejs/kit";

import {
  getSlideshowByRoute,
  getSlideshowRouteEntries,
} from "$lib/shared/project";

export const entries = getSlideshowRouteEntries;

export const load = ({ params }) => {
  if (!getSlideshowByRoute(params.slideshow)) {
    error(404, `Slideshow not found: ${params.slideshow}`);
  }

  return {
    slideshow: params.slideshow,
  };
};
