export * from "@allmaps/slides/model/basemap";
import { env } from "$env/dynamic/public";
import { mapStyleFiles } from "$lib/shared/content-package";
import {
  getEffectiveBasemapStyleConfig as getConfig,
  resolveBasemapStyle as resolveStyle,
} from "@allmaps/slides/model/basemap";
export const getEffectiveBasemapStyleConfig = (
  options: Parameters<typeof getConfig>[0],
) => {
  const config = getConfig(options);
  config.protomaps.key ||= env.PUBLIC_PROTOMAPS_KEY;
  return config;
};
export const resolveBasemapStyle = (
  options: Parameters<typeof resolveStyle>[0],
) => resolveStyle({ ...options, mapStyleFiles });
