import { runSite } from "../../build/index.ts";
import type { LoadSlidesConfigOptions } from "../../content/config.ts";
export const runAppCommand = (command: "dev" | "build" | "preview" | "check" | "thumbnails", options: LoadSlidesConfigOptions & { args?: string[] } = {}) =>
  runSite(command, options, options.args);
