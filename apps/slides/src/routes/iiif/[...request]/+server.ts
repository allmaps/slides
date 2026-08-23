import { dev } from "$app/environment";
import {
  createIiifRoute,
  getIiifPublicUrlFromRequest,
} from "@allmaps/sveltekit-iiif/route";
import catalog from "virtual:allmaps-iiif/server";

const route = createIiifRoute(catalog, {
  getPublicUrl: ({ url }) =>
    dev ? getIiifPublicUrlFromRequest(url) : undefined,
});

export const prerender = true;
export const entries = route.entries;
export const GET = route.GET;
