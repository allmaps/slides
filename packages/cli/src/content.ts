import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

import { type SlidesConfig } from "./config.ts";

type ProjectManifest = {
  id?: string;
  slug?: string;
};

type ContentPackage = {
  name?: string;
};

type ContentProject = {
  folder: string;
  slug: string;
  manifestPath: string;
};

export type ContentResult = {
  projects: ContentProject[];
};

type ContentWatcher = {
  close: () => void;
};

const manifestFilename = "project.yml";
const packageFilename = "package.json";
const WATCH_INTERVAL_MS = 1000;

const getDirectoryEntries = async (directory: string) => {
  try {
    return await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
};

const getPathStat = async (entryPath: string) => {
  try {
    return await lstat(entryPath);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
};

const parseProjectManifest = async (
  manifestPath: string,
): Promise<ProjectManifest> => {
  const contents = await readFile(manifestPath, "utf8");
  return (parse(contents) ?? {}) as ProjectManifest;
};

const getProjectManifestPath = (projectDir: string) =>
  path.join(projectDir, manifestFilename);

const validateContentPackage = async (config: SlidesConfig) => {
  const packagePath = path.join(config.sourceContentDir, packageFilename);
  const packageStat = await getPathStat(packagePath);

  if (!packageStat?.isFile()) {
    throw new Error(
      `${packagePath} is required so the app can import ${config.contentPackageName}`,
    );
  }

  const packageJson = JSON.parse(
    await readFile(packagePath, "utf8"),
  ) as ContentPackage;

  if (packageJson.name !== config.contentPackageName) {
    throw new Error(
      `${packagePath} must define "name": "${config.contentPackageName}"`,
    );
  }
};

const findProjects = async (contentDir: string): Promise<ContentProject[]> => {
  const projects: ContentProject[] = [];

  const addProject = async (projectDir: string, folder: string) => {
    const manifestPath = getProjectManifestPath(projectDir);

    try {
      const manifest = await parseProjectManifest(manifestPath);

      projects.push({
        folder,
        slug:
          manifest.slug ?? manifest.id ?? (folder || path.basename(projectDir)),
        manifestPath,
      });

      return true;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  };

  await addProject(contentDir, "");

  for (const entry of await readdir(contentDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const projectDir = path.join(contentDir, entry.name);
    const projectFound = await addProject(projectDir, entry.name);

    if (projectFound || entry.name !== "content") continue;

    for (const nestedEntry of await getDirectoryEntries(projectDir)) {
      if (!nestedEntry.isDirectory()) continue;

      await addProject(
        path.join(projectDir, nestedEntry.name),
        nestedEntry.name,
      );
    }
  }

  return projects.sort((a, b) => a.folder.localeCompare(b.folder));
};

export const validateContent = async (
  config: SlidesConfig,
): Promise<ContentResult> => {
  await validateContentPackage(config);

  const projects = await findProjects(config.sourceContentDir);

  if (!projects.length) {
    throw new Error(`No projects found in ${config.sourceContentDir}`);
  }

  if (config.singleProjectRoot && projects.length !== 1) {
    throw new Error(
      `singleProjectRoot requires exactly one project, found ${projects.length}`,
    );
  }

  return { projects };
};

export const formatContentResult = (
  config: SlidesConfig,
  result: ContentResult,
) => {
  const projectLabel =
    result.projects.length === 1
      ? result.projects[0].slug
      : `${result.projects.length} projects`;
  const contentLabel =
    path.relative(process.cwd(), config.sourceContentDir) || ".";

  return `Loaded ${projectLabel} from ${contentLabel} as ${config.contentPackageName}.`;
};

export const watchContent = (
  config: SlidesConfig,
  onValidated: (result: ContentResult) => void,
) => {
  let previousSnapshot: string | undefined;
  let isClosed = false;
  let isValidating = false;
  let validationQueued = false;

  const getDirectorySnapshot = async (
    directory: string,
    root = directory,
  ): Promise<string[]> => {
    const snapshot: string[] = [];

    for (const entry of (await getDirectoryEntries(directory)).toSorted((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const entryPath = path.join(directory, entry.name);
      const stats = await getPathStat(entryPath);
      if (!stats) continue;

      const relativePath = path.relative(root, entryPath);
      const type = stats.isDirectory() ? "dir" : "file";

      snapshot.push(
        `${relativePath}:${type}:${stats.size}:${stats.mtimeMs}`,
      );

      if (stats.isDirectory()) {
        snapshot.push(...(await getDirectorySnapshot(entryPath, root)));
      }
    }

    return snapshot;
  };

  const getContentSnapshot = async () =>
    (await getDirectorySnapshot(config.sourceContentDir)).join("\n");

  const runValidation = async () => {
    if (isValidating) {
      validationQueued = true;
      return;
    }

    isValidating = true;

    do {
      validationQueued = false;

      try {
        onValidated(await validateContent(config));
      } catch (error) {
        console.error(error instanceof Error ? error.message : error);
      }
    } while (validationQueued && !isClosed);

    isValidating = false;
  };

  const poll = async () => {
    try {
      const nextSnapshot = await getContentSnapshot();

      if (previousSnapshot === undefined) {
        previousSnapshot = nextSnapshot;
        return;
      }

      if (nextSnapshot !== previousSnapshot) {
        previousSnapshot = nextSnapshot;
        await runValidation();
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  };

  const interval = setInterval(() => {
    void poll();
  }, WATCH_INTERVAL_MS);

  void poll();

  return {
    close() {
      isClosed = true;
      clearInterval(interval);
    },
  } satisfies ContentWatcher;
};
