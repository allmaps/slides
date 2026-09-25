import { dev } from "$app/environment";
import { createIiifRoute, getIiifPublicUrlFromRequest } from "@allmaps/iiif/route";
import catalog from "virtual:slides/iiif-server";
const route = createIiifRoute(catalog, {
  getPublicUrl: dev ? event => getIiifPublicUrlFromRequest(event.url) : undefined,
});
export const prerender = true;
export const entries = route.entries;
export const GET = route.GET;
