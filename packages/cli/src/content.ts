import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { type SlidesConfig } from "./config.ts";

type ContentPackage = {
  name?: string;
};

export type ContentResult = {
  slideCount: number;
  slideshowCount: number;
};

type ContentWatcher = {
  close: () => void;
};

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

const countMarkdownFiles = async (directory: string): Promise<number> => {
  let count = 0;

  for (const entry of await getDirectoryEntries(directory)) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      count += await countMarkdownFiles(entryPath);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      count += 1;
    }
  }

  return count;
};

export const validateContent = async (
  config: SlidesConfig,
): Promise<ContentResult> => {
  await validateContentPackage(config);

  const slideshowPaths = (config.raw.slideshows ?? []).flatMap((slideshow) =>
    typeof slideshow.path === "string" && slideshow.path.trim()
      ? [slideshow.path]
      : [],
  );

  let slideCount = 0;

  for (const slideshowPath of slideshowPaths) {
    const directory = path.resolve(config.sourceContentDir, slideshowPath);
    const stat = await getPathStat(directory);

    if (!stat?.isDirectory()) {
      throw new Error(`Slideshow directory not found: ${directory}`);
    }

    slideCount += await countMarkdownFiles(directory);
  }

  return { slideCount, slideshowCount: slideshowPaths.length };
};

export const formatContentResult = (
  config: SlidesConfig,
  result: ContentResult,
) => {
  const contentLabel =
    path.relative(process.cwd(), config.sourceContentDir) || ".";
  const slideLabel = `${result.slideCount} ${result.slideCount === 1 ? "slide" : "slides"}`;
  const slideshowLabel = `${result.slideshowCount} ${result.slideshowCount === 1 ? "slideshow" : "slideshows"}`;

  return `Loaded ${slideLabel} in ${slideshowLabel} from ${contentLabel} as ${config.contentPackageName}.`;
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
