import { readIiifCatalog } from "@allmaps/iiif/catalog";
import type { IiifCatalog } from "@allmaps/iiif";

export { getIiifOverview } from "@allmaps/iiif/catalog";
export { createIiifRoute, getIiifPublicUrlFromRequest } from "@allmaps/iiif/route";
export { resolveAnnotationImages } from "@allmaps/iiif/annotations";

export type IiifServerConfig = {
  enabled: boolean;
  filename: string;
  allowMissing: boolean;
};

export function createSlidesIiifCatalog(config: IiifServerConfig): IiifCatalog {
  return config.enabled
    ? readIiifCatalog(config.filename, { allowMissing: config.allowMissing })
    : { entries: async () => [], get: async () => new Response("Not found", { status: 404 }) };
}
