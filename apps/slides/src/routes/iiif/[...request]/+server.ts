import { createIiifRoute } from "@allmaps/iiif/route";
import catalog from "virtual:slides/iiif-server";
const route = createIiifRoute(catalog);
export const prerender = true;
export const entries = route.entries;
export const GET = route.GET;
