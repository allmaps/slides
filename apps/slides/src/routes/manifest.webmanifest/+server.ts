import { base } from "$app/paths";
import { json } from "@sveltejs/kit";
import appIcon from "$lib/assets/apple-touch-icon.png";
import { project } from "$lib/shared/content-package";
import { createWebAppManifest } from "$lib/shared/web-app";

export const prerender = true;

export const GET = () => json(createWebAppManifest(project, base, appIcon), {
  headers: { "Content-Type": "application/manifest+json" },
});
