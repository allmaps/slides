import {
  getThumbnailAsset,
  thumbnailEntries,
} from "$lib/server/thumbnails/catalog";

export const prerender = true;
export const entries = thumbnailEntries;
export const GET = ({ params }: { params: { filename: string } }) =>
  getThumbnailAsset(params.filename);
