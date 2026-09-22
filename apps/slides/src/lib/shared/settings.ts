import baseUrl from "$lib/shared/base-url";
import type { SourceSpecification } from "maplibre-gl";
export * from "@allmaps/slides/model/settings";
export const DEFAULT_SOURCES: { [key: string]: SourceSpecification } = {
  route: {
    type: "geojson",
    data: `${baseUrl}/geojson/route.geojson`,
  },
};
