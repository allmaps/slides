import path from "node:path";
import { loadContent } from "../content/index.ts";
import type { RuntimeSlidesConfig } from "../content/config.ts";
export const validateContent = loadContent;
export const formatContentResult = (config: RuntimeSlidesConfig, result: { slideCount: number; slideshowCount: number }) =>
  `Loaded ${result.slideCount} slides in ${result.slideshowCount} slideshows from ${path.relative(process.cwd(), config.sourceContentDir) || "."}.`;
