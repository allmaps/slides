import type { IiifCatalog } from "./core.ts";

type RouteEvent = {
  params: {
    request?: string;
  };
  url: URL;
};

type IiifRouteOptions = {
  getPublicUrl?: (event: RouteEvent) => string | undefined;
};

export function getIiifPublicUrlFromRequest(url: URL) {
  const segments = url.pathname.split("/");
  const iiifSegmentIndex = segments.indexOf("iiif");
  const basePath =
    iiifSegmentIndex === -1 ? "" : segments.slice(0, iiifSegmentIndex).join("/");

  return `${url.origin}${basePath}`;
}

export function createIiifRoute(
  catalog: IiifCatalog,
  options: IiifRouteOptions = {},
) {
  return {
    entries: catalog.entries,
    GET: (event: RouteEvent) =>
      catalog.get(event.params.request, {
        publicUrl: options.getPublicUrl?.(event),
      }),
  };
}
