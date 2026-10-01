import { dev } from "$app/environment";
import { createIiifRoute, getIiifPublicUrlFromRequest } from "@allmaps/slides/server/iiif";
import catalog from "$lib/server/iiif";
const route = createIiifRoute(catalog, {
  getPublicUrl: dev ? event => getIiifPublicUrlFromRequest(event.url) : undefined,
});
export const prerender = true;
export const entries = route.entries;
export const GET = route.GET;
