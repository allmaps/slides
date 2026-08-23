import type { SourceSpecification } from "maplibre-gl";
import { projectFiles, slideFiles } from "@allmaps/slides-content";
import { parse } from "yaml";

import {
  getContentAssetUrl,
  joinUrl,
  withBaseUrl,
} from "$lib/shared/paths";
import { isSingleProjectRootRequested } from "$lib/shared/routing";
import type {
  MapChapter,
  Project,
  ProjectManifest,
  ProjectSlideshowDefinition,
  ProjectSourceDefinition,
  Slideshow,
  WarpedMapProps,
} from "$lib/shared/types";
import { getValueAsArray } from "$lib/shared/utils";

const parseProjectManifest = (
  raw: string,
  fallbackId: string,
): ProjectManifest => {
  const manifest = (parse(raw) ?? {}) as Partial<ProjectManifest>;
  const slideshows = manifest.slideshows ?? [];
  const main =
    manifest.main?.trim() ||
    (slideshows.length === 1 ? slideshows[0].id : "main");

  return {
    id: manifest.id ?? fallbackId,
    slug: manifest.slug ?? manifest.id ?? fallbackId,
    title: manifest.title ?? fallbackId,
    description: manifest.description,
    main,
    slideshows,
    sources: manifest.sources ?? {},
  };
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

const hasWarpedMapUrl = (warpedMap: unknown): warpedMap is WarpedMapProps =>
  typeof warpedMap === "object" &&
  warpedMap !== null &&
  typeof (warpedMap as { url?: unknown }).url === "string" &&
  (warpedMap as { url: string }).url.trim().length > 0;

const resolveWarpedMaps = (
  projectFolder: string,
  metadata: Record<string, any>,
) => {
  if (!metadata.warpedMaps) return metadata;

  const warpedMaps = getValueAsArray(metadata.warpedMaps)
    .filter(hasWarpedMapUrl)
    .map((warpedMap) => {
      const url = warpedMap.url.trim();

      return {
        ...warpedMap,
        url: getContentAssetUrl(projectFolder, url) ?? url,
      };
    });

  if (!warpedMaps.length) {
    const metadataWithoutWarpedMaps = { ...metadata };
    delete metadataWithoutWarpedMaps.warpedMaps;
    return metadataWithoutWarpedMaps;
  }

  return {
    ...metadata,
    warpedMaps,
  };
};

const createSource = (
  projectFolder: string,
  source: ProjectSourceDefinition,
): SourceSpecification => {
  if (source.type === "geojson") {
    return {
      type: "geojson",
      data:
        getContentAssetUrl(projectFolder, source.path ?? source.url ?? "") ??
        source.path ??
        source.url ??
        "",
    };
  }

  const sourceUrl = source.url ?? source.path;

  return {
    ...source,
    url: sourceUrl
      ? (getContentAssetUrl(projectFolder, sourceUrl) ?? sourceUrl)
      : undefined,
  } as SourceSpecification;
};

const buildProjects = () => {
  const slidesByProjectAndSlideshow = new Map<string, MapChapter[]>();

  for (const [path, mod] of Object.entries(slideFiles).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const { projectFolder, slideshowPath, filename } = getSlideParts(path);
    const key = getProjectSlideshowKey(projectFolder, slideshowPath);
    const slides = slidesByProjectAndSlideshow.get(key) ?? [];

    slides.push({
      slug: getSlideSlug(filename),
      Component: mod.default,
      ...mod.metadata,
    } as MapChapter);

    slidesByProjectAndSlideshow.set(key, slides);
  }

  return Object.entries(projectFiles)
    .map(([path, raw]) => {
      const folder = getProjectFolder(path);
      const manifest = parseProjectManifest(raw, folder);
      const sources = Object.fromEntries(
        Object.entries(manifest.sources ?? {}).map(([sourceId, source]) => [
          sourceId,
          createSource(folder, source),
        ]),
      );
      const slideshows: Slideshow[] = manifest.slideshows.map((rawSlideshow) => {
        const slideshow = normalizeSlideshow(rawSlideshow, manifest.main);
        const chapters = (
          slidesByProjectAndSlideshow.get(
            getProjectSlideshowKey(folder, slideshow.path),
          ) ?? []
        ).map((chapter) => ({
          ...chapter,
          ...resolveWarpedMaps(folder, chapter),
        }));

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

const getMainSlideshow = (project: Project) =>
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
