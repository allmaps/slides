import { building } from "$app/environment";
import { getThumbnails } from "$lib/server/thumbnails/catalog";

export const load = async () => ({ thumbnails: await getThumbnails(building) });
