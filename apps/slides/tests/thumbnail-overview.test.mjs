import assert from "node:assert/strict";
import { test } from "node:test";
import { thumbnailOverview } from "../src/lib/shared/thumbnail-overview.ts";
import { layerPreviewKey } from "@allmaps/slides/model/map/annotations";
import { emptyThumbnails } from "@allmaps/slides/model/thumbnails";

test("overview separates theme/map variants and marks the social image on each slideshow's first chapter", () => {
  const map = { url: "https://example.org/annotation", darkOptions: { colorize: true } };
  const project = { slideshows: [
    { id: "main", chapters: [{ slug: "one", warpedMaps: [map] }, { slug: "two" }] },
    { id: "detail", start: { warpedMaps: [map] }, chapters: [{ slug: "one" }] },
  ] };
  const thumbnail = path => ({ path, width: 540, height: 400 });
  const manifest = emptyThumbnails();
  manifest.slides['main:one'] = { light: thumbnail('light.webp'), dark: thumbnail('dark.webp') };
  for (const theme of ['light', 'dark']) manifest.layers[layerPreviewKey(map, theme)] = thumbnail(`${theme}-layer.webp`);
  manifest.social.main = thumbnail('main.jpg');
  manifest.social.detail = thumbnail('detail.jpg');
  const shows = thumbnailOverview(project, manifest);
  assert.deepEqual(shows[0].chapters[0].images.map(preview => preview.label), ['thumbnailLight', 'thumbnailDark', 'thumbnailSocial', 'thumbnailLayerLight', 'thumbnailLayerDark']);
  assert.equal(shows[0].chapters[0].images.find(preview => preview.social).image.path, 'main.jpg');
  assert.deepEqual(shows[0].chapters[1].images, []);
  assert.equal(shows[1].chapters[0].images.find(preview => preview.social).image.path, 'detail.jpg');
  assert.deepEqual(shows[1].startImages.map(preview => preview.image.path), ['light-layer.webp', 'dark-layer.webp']);
  assert.ok(thumbnailOverview(project, emptyThumbnails()).every(show => show.chapters.every(chapter => !chapter.images.length)));
});
