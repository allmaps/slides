import type { Project } from "@allmaps/slides/model/types";

/** Keep installation and navigation on the current deployment's origin/path. */
export function createWebAppManifest(project: Project, basePath: string, iconUrl: string) {
  const root = `${basePath.replace(/\/+$/, "")}/`;
  const name = project.slideshows.find(show => show.id === project.main)?.title ?? project.title;
  return {
    id: root,
    name,
    short_name: name,
    description: project.description,
    start_url: root,
    scope: root,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: iconUrl, sizes: "180x180", type: "image/png", purpose: "any" }],
  };
}
