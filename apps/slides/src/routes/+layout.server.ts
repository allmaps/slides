import { building } from "$app/environment";
import { getThumbnails } from "$lib/server/thumbnails/catalog";
import { env } from "$env/dynamic/private";

export const load = async () => ({
  thumbnails: await getThumbnails(building),
  generation: {
    iiif: env.SLIDES_IIIF_ENABLED !== "false",
    thumbnails: env.SLIDES_THUMBNAILS_ENABLED !== "false",
  },
});
