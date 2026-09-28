import catalog from "virtual:slides/iiif-server";
import { getIiifOverview } from "@allmaps/iiif/catalog";

export const trailingSlash = "always";
export const load = async () => ({ iiif: await getIiifOverview(catalog) });
