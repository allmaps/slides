export type Thumbnail = { path: string; width: number; height: number };
export type ThumbnailManifest = {
  slides: Record<string, { light: Thumbnail; dark: Thumbnail }>;
  layers: Record<string, Thumbnail>;
  social: Record<string, Thumbnail>;
  annotations: Record<string, string>;
};
export const emptyThumbnails = (): ThumbnailManifest => ({
  slides: {},
  layers: {},
  social: {},
  annotations: {},
});
export const slidePreviewKey = (slideshow: string, chapter: string) =>
  `${slideshow}:${chapter}`;
