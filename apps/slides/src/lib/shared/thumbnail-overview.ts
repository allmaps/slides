import { layerPreviewKey } from "@allmaps/slides/model/map/annotations";
import { slidePreviewKey, type Thumbnail, type ThumbnailManifest } from "@allmaps/slides/model/thumbnails";
import type { Project, WarpedMapProps } from "@allmaps/slides/model/types";

export type OverviewImage = {
  image: Thumbnail;
  label: "thumbnailLight" | "thumbnailDark" | "thumbnailSocial" | "thumbnailLayerLight" | "thumbnailLayerDark";
  count?: number;
  social?: boolean;
};

export const thumbnailShowAnchor = (showIndex: number) => `thumbnails-show-${showIndex + 1}`;
export const thumbnailSlideAnchor = (showIndex: number, chapterIndex: number | "start") =>
  `${thumbnailShowAnchor(showIndex)}-${chapterIndex === "start" ? "start" : `slide-${chapterIndex + 1}`}`;

export function thumbnailOverview(project: Project, manifest: ThumbnailManifest) {
  const layerImages = (maps: WarpedMapProps[] = []) => maps.flatMap((map, index) => {
    const images: OverviewImage[] = [];
    for (const theme of ["light", "dark"] as const) {
      const image = manifest.layers[layerPreviewKey(map, theme)];
      if (image) images.push({ image, label: theme === "light" ? "thumbnailLayerLight" : "thumbnailLayerDark", count: index + 1 });
    }
    return images;
  });
  return project.slideshows.map(show => ({ ...show, startImages: layerImages(show.start?.warpedMaps), chapters: show.chapters.map((chapter, index) => {
    const previews = manifest.slides[slidePreviewKey(show.id, chapter.slug)];
    const images: OverviewImage[] = [];
    if (previews) images.push({ image: previews.light, label: "thumbnailLight" }, { image: previews.dark, label: "thumbnailDark" });
    if (index === 0 && manifest.social[show.id]) images.push({ image: manifest.social[show.id], label: "thumbnailSocial", social: true });
    images.push(...layerImages(chapter.warpedMaps));
    return { ...chapter, images };
  }) }));
}
