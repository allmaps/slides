export * from "@allmaps/slides/model/types";
import type {
  MapChapter as Chapter,
  Slideshow as Show,
  Project as ModelProject,
} from "@allmaps/slides/model/types";
import type { Component } from "svelte";
export type MapChapter = Chapter & { Component: Component };
export type Slideshow = Omit<Show, "chapters"> & {
  chapters: MapChapter[];
  CreditsComponent?: Component<{ hideTitle?: boolean }>;
};
export type Project = Omit<ModelProject, "slideshows"> & {
  slideshows: Slideshow[];
  CreditsComponent?: Component<{ hideTitle?: boolean }>;
};
