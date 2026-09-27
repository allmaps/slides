import type { Project } from "@allmaps/slides/model/types";

/** Keep installation and navigation on the current deployment's origin/path. */
export function createWebAppManifest(project: Project, basePath: string, iconUrl: string) {
  const root = `${basePath.replace(/\/+$/, "")}/`;
  return {
    id: root,
    name: project.titleLong ?? project.title,
    short_name: project.title,
    description: project.descriptionLong ?? project.description,
    start_url: root,
    scope: root,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [{ src: iconUrl, sizes: "180x180", type: "image/png", purpose: "any" }],
  };
}
