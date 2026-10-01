import catalog from "$lib/server/iiif";
import { getIiifOverview } from "@allmaps/slides/server/iiif";

export const trailingSlash = "always";
export const load = async () => ({ iiif: await getIiifOverview(catalog) });
