import type { SourceSpecification } from "maplibre-gl";
import { projectFiles, slideFiles } from "@allmaps/slides-content";
import { parse } from "yaml";

import {
  parseProjectConfig,
  parseSlideMetadata,
  type ParsedSlideMetadata,
} from "$lib/shared/content-schema";
import { getContentAssetUrl, joinUrl, withBaseUrl } from "$lib/shared/paths";
import { isSingleProjectRootRequested } from "$lib/shared/routing";
import type {
  MapChapter,
  Project,
  ProjectManifest,
  ProjectSlideshowDefinition,
  ProjectSourceDefinition,
  Slideshow,
} from "$lib/shared/types";

const parseProjectManifest = (
  raw: string,
  path: string,
  fallbackId: string,
): ProjectManifest | undefined => {
  let config: unknown;

  try {
    config = parse(raw) ?? {};
  } catch (error) {
    console.warn(
      `Skipping this project because project.yml could not be read:\n${path}\n  - ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }

  const result = parseProjectConfig(config, path, fallbackId);

  return result.success ? result.data : undefined;
};

const getProjectFolder = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/");
  const manifestIndex = parts.lastIndexOf("project.yml");
  const projectFolder = manifestIndex > 1 ? parts[manifestIndex - 1] : "";
  if (manifestIndex === -1) {
    throw new Error(`Could not infer project folder from ${path}`);
  }

  return projectFolder;
};

const getSlideParts = (path: string) => {
  const parts = path.replace(/\\/g, "/").split("/");
  const slideshowsIndex = parts.lastIndexOf("slideshows");
  const filename = parts.at(-1)?.replace(/\.md$/, "");
  const projectFolder = slideshowsIndex > 1 ? parts[slideshowsIndex - 1] : "";

  if (slideshowsIndex === -1 || !filename) {
    throw new Error(`Could not infer slide path from ${path}`);
  }

  return {
    projectFolder,
    slideshowPath: `slideshows/${parts.slice(slideshowsIndex + 1, -1).join("/")}`,
    filename,
  };
};

const getProjectSlideshowKey = (projectFolder: string, slideshowPath: string) =>
  `${projectFolder}\0${slideshowPath}`;

const getSlideSlug = (filename: string) =>
  filename.replace(/^\d+[-_]/, "").replace(/\.md$/, "");

const normalizeSlideshow = (
  slideshow: ProjectSlideshowDefinition,
  mainSlideshowId: string,
): ProjectSlideshowDefinition & { slug: string } => ({
  ...slideshow,
  slug: slideshow.id === mainSlideshowId ? "" : (slideshow.slug ?? slideshow.id),
});

const resolveWarpedMaps = (
  projectFolder: string,
  metadata: ParsedSlideMetadata,
) => {
  if (!metadata.warpedMaps) return metadata;

  return {
    ...metadata,
    warpedMaps: metadata.warpedMaps.map((warpedMap) => ({
      ...warpedMap,
      url: getContentAssetUrl(projectFolder, warpedMap.url) ?? warpedMap.url,
    })),
  };
};

const createSource = (
  projectFolder: string,
  source: ProjectSourceDefinition,
): SourceSpecification => {
  const sourceUrl = (source.path ?? source.url) as string;

  if (source.type === "geojson") {
    return {
      type: "geojson",
      data: getContentAssetUrl(projectFolder, sourceUrl) ?? sourceUrl,
    };
  }

  return {
    ...source,
    url: getContentAssetUrl(projectFolder, sourceUrl) ?? sourceUrl,
  } as SourceSpecification;
};

const buildProjects = () => {
  const slidesByProjectAndSlideshow = new Map<string, MapChapter[]>();

  for (const [path, mod] of Object.entries(slideFiles).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const { projectFolder, slideshowPath, filename } = getSlideParts(path);
    const result = parseSlideMetadata(mod.metadata, path);

    if (!result.success) continue;

    const key = getProjectSlideshowKey(projectFolder, slideshowPath);
    const slides = slidesByProjectAndSlideshow.get(key) ?? [];

    slides.push({
      slug: getSlideSlug(filename),
      Component: mod.default,
      ...resolveWarpedMaps(projectFolder, result.data),
    });

    slidesByProjectAndSlideshow.set(key, slides);
  }

  return Object.entries(projectFiles)
    .flatMap(([path, raw]) => {
      const folder = getProjectFolder(path);
      const manifest = parseProjectManifest(raw, path, folder);

      if (!manifest) return [];

      const sources = Object.fromEntries(
        Object.entries(manifest.sources).map(([sourceId, source]) => [
          sourceId,
          createSource(folder, source),
        ]),
      );
      const slideshows: Slideshow[] = manifest.slideshows.map((rawSlideshow) => {
        const slideshow = normalizeSlideshow(rawSlideshow, manifest.main);
        const chapters =
          slidesByProjectAndSlideshow.get(
            getProjectSlideshowKey(folder, slideshow.path),
          ) ?? [];

        return {
          ...slideshow,
          title: slideshow.title ?? manifest.title,
          chapters,
          sources,
        };
      });

      return {
        ...manifest,
        folder,
        sources,
        slideshows,
      };
    })
    .toSorted((a, b) => a.title.localeCompare(b.title));
};

const projects = buildProjects();

export const getProjects = () => projects;

export const getProject = (projectSlug: string) =>
  projects.find((project) => project.slug === projectSlug);

export const getMainSlideshow = (project: Project) =>
  project.slideshows.find((candidate) => candidate.id === project.main);

export const isSingleProjectRootMode = () =>
  isSingleProjectRootRequested() && projects.length === 1;

export const getRootSlideshowByRoute = (slideshowSlug?: string) => {
  if (!isSingleProjectRootMode()) return undefined;

  const project = projects[0];
  const slideshow = slideshowSlug
    ? project.slideshows.find((candidate) => candidate.slug === slideshowSlug)
    : getMainSlideshow(project);

  if (!slideshow) return undefined;

  return { project, slideshow };
};

export const getSlideshowByRoute = (
  projectSlug: string,
  slideshowSlug?: string,
) => {
  const project = getProject(projectSlug);
  if (!project) return undefined;

  const slideshow = slideshowSlug
    ? project.slideshows.find((candidate) => candidate.slug === slideshowSlug)
    : getMainSlideshow(project);

  if (!slideshow) return undefined;

  return { project, slideshow };
};

export const getProjectRouteHref = (project: Project) =>
  isSingleProjectRootMode() && projects[0]?.slug === project.slug
    ? withBaseUrl("")
    : withBaseUrl(project.slug);

export const getSlideshowRouteHref = (
  project: Project,
  slideshow: Slideshow,
) =>
  isSingleProjectRootMode() && projects[0]?.slug === project.slug
    ? withBaseUrl(slideshow.slug)
    : withBaseUrl(joinUrl(project.slug, slideshow.slug));

export const getMainRouteEntries = () => {
  if (isSingleProjectRootMode()) {
    const project = projects[0];

    return project.slideshows
      .filter((slideshow) => slideshow.id !== project.main && slideshow.slug)
      .map((slideshow) => ({
        project: slideshow.slug,
      }));
  }

  return projects.map((project) => ({
    project: project.slug,
  }));
};

export const getSubslideshowRouteEntries = () => {
  if (isSingleProjectRootMode()) return [];

  return projects.flatMap((project) =>
    project.slideshows
      .filter((slideshow) => slideshow.id !== project.main && slideshow.slug)
      .map((slideshow) => ({
        project: project.slug,
        slideshow: slideshow.slug,
      })),
  );
};
