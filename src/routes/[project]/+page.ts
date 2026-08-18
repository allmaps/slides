import { error } from "@sveltejs/kit";

import {
  getMainRouteEntries,
  getSlideshowByRoute,
} from "$lib/shared/projects";

export const entries = getMainRouteEntries;

export const load = ({ params }) => {
  if (!getSlideshowByRoute(params.project)) {
    error(404, `Project not found: ${params.project}`);
  }

  return {
    project: params.project,
  };
};
