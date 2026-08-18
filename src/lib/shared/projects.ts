import type { SourceSpecification } from "maplibre-gl";
import { parse } from "yaml";

import { getProjectAssetBase, resolveProjectAssetUrl } from "$lib/shared/paths";
import type {
  MapChapter,
  Project,
  ProjectManifest,
  ProjectSourceDefinition,
  Slideshow,
  WarpedMapProps,
} from "$lib/shared/types";
import { getValueAsArray } from "$lib/shared/utils";

type MarkdownModule = {
  default: any;
  metadata: Record<string, unknown>;
};

const projectFiles = import.meta.glob("$content/*/project.yml", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const slideFiles = import.meta.glob(
  "$content/*/slideshows/**/*.md",
  {
    eager: true,
  },
) as Record<string, MarkdownModule>;

const parseProjectManifest = (
  raw: string,
  fallbackId: string,
): ProjectManifest => {
  const manifest = (parse(raw) ?? {}) as Partial<ProjectManifest>;

  return {
    id: manifest.id ?? fallbackId,
    slug: manifest.slug ?? fallbackId,
    title: manifest.title ?? fallbackId,
    description: manifest.description,
    main: manifest.main ?? "main",
    slideshows: manifest.slideshows ?? [],
    sources: manifest.sources ?? {},
  };
};

const getProjectFolder = (path: string) => {
  const match = path.match(/content\/([^/]+)\/project\.yml$/);
  if (!match) throw new Error(`Could not infer project folder from ${path}`);

  return match[1];
};

const getSlideParts = (path: string) => {
  const match = path.match(
    /content\/([^/]+)\/slideshows\/(.+)\/([^/]+)\.md$/,
  );
  if (!match) throw new Error(`Could not infer slide path from ${path}`);

  return {
    projectFolder: match[1],
    slideshowPath: `slideshows/${match[2]}`,
    filename: match[3],
  };
};

const getSlideSlug = (filename: string) =>
  filename.replace(/^\d+[-_]/, "").replace(/\.md$/, "");

const resolveWarpedMaps = (projectSlug: string, metadata: Record<string, any>) => {
  if (!metadata.warpedMaps) return metadata;

  return {
    ...metadata,
    warpedMaps: getValueAsArray(metadata.warpedMaps).map(
      (warpedMap: WarpedMapProps) => ({
        ...warpedMap,
        url: resolveProjectAssetUrl(projectSlug, warpedMap.url),
      }),
    ),
  };
};

const createSource = (
  projectSlug: string,
  source: ProjectSourceDefinition,
): SourceSpecification => {
  if (source.type === "geojson") {
    return {
      type: "geojson",
      data: resolveProjectAssetUrl(projectSlug, source.path ?? source.url ?? ""),
    };
  }

  return {
    ...source,
    url: source.url
      ? resolveProjectAssetUrl(projectSlug, source.url)
      : source.path
        ? resolveProjectAssetUrl(projectSlug, source.path)
        : undefined,
  } as SourceSpecification;
};

const buildProjects = () => {
  const slidesByProjectAndSlideshow = new Map<string, MapChapter[]>();

  for (const [path, mod] of Object.entries(slideFiles).toSorted(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const { projectFolder, slideshowPath, filename } = getSlideParts(path);
    const key = `${projectFolder}/${slideshowPath}`;
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
          createSource(manifest.slug, source),
        ]),
      );
      const slideshows: Slideshow[] = manifest.slideshows.map((slideshow) => {
        const chapters = (
          slidesByProjectAndSlideshow.get(`${folder}/${slideshow.path}`) ?? []
        ).map((chapter) => ({
          ...chapter,
          ...resolveWarpedMaps(manifest.slug, chapter),
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
        assetBase: getProjectAssetBase(manifest.slug),
      };
    })
    .toSorted((a, b) => a.title.localeCompare(b.title));
};

const projects = buildProjects();

export const getProjects = () => projects;

export const getProject = (projectSlug: string) =>
  projects.find((project) => project.slug === projectSlug);

export const getSlideshowByRoute = (
  projectSlug: string,
  slideshowSlug?: string,
) => {
  const project = getProject(projectSlug);
  if (!project) return undefined;

  const slideshow = slideshowSlug
    ? project.slideshows.find((candidate) => candidate.slug === slideshowSlug)
    : project.slideshows.find((candidate) => candidate.id === project.main);

  if (!slideshow) return undefined;

  return { project, slideshow };
};

export const getMainRouteEntries = () =>
  projects.map((project) => ({
    project: project.slug,
  }));

export const getSubslideshowRouteEntries = () =>
  projects.flatMap((project) =>
    project.slideshows
      .filter((slideshow) => slideshow.id !== project.main && slideshow.slug)
      .map((slideshow) => ({
        project: project.slug,
        slideshow: slideshow.slug,
      })),
  );
