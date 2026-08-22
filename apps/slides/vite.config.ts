import { sveltekit } from "@sveltejs/kit/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { parse } from "yaml";

const contentRoot = path.resolve("content");
const staticProjectAssetsRoot = path.resolve("static", "assets");
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

type ProjectAssetManifest = {
  id?: string;
  slug?: string;
};

type ProjectAssets = {
  slug: string;
  assetDir: string;
};

const isTruthy = (value: string | undefined) =>
  TRUE_VALUES.has(value?.trim().toLowerCase() ?? "");

const isSingleProjectRootRequested = () =>
  isTruthy(process.env.PUBLIC_SLIDES_SINGLE_PROJECT_ROOT);

const getProjectSlug = (projectDir: string, fallback: string) => {
  const manifestPath = path.join(projectDir, "project.yml");
  const manifest = parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as ProjectAssetManifest | null;

  return manifest?.slug ?? manifest?.id ?? fallback;
};

const getProjectsWithManifests = () => {
  if (!fs.existsSync(contentRoot)) return [];

  const projects: ProjectAssets[] = [];

  for (const dirent of fs.readdirSync(contentRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;

    const projectDir = path.join(contentRoot, dirent.name);
    const manifestPath = path.join(projectDir, "project.yml");

    if (!fs.existsSync(manifestPath)) continue;

    projects.push({
      slug: getProjectSlug(projectDir, dirent.name),
      assetDir: path.join(projectDir, "assets"),
    });
  }

  return projects;
};

const isExternalAssetRoot = () => {
  try {
    const assetRoot = fs.lstatSync(staticProjectAssetsRoot);

    if (assetRoot.isSymbolicLink()) return true;
    if (!assetRoot.isDirectory()) return false;

    return fs
      .readdirSync(staticProjectAssetsRoot)
      .some((entry) =>
        fs
          .lstatSync(path.join(staticProjectAssetsRoot, entry))
          .isSymbolicLink(),
      );
  } catch {
    return false;
  }
};

const syncProjectAssets = () => {
  if (isExternalAssetRoot()) return;

  fs.rmSync(staticProjectAssetsRoot, { recursive: true, force: true });

  const projects = getProjectsWithManifests();
  const useRootAssetDirectory =
    isSingleProjectRootRequested() && projects.length === 1;

  for (const project of projects) {
    if (!fs.existsSync(project.assetDir)) continue;

    const targetDir = useRootAssetDirectory
      ? staticProjectAssetsRoot
      : path.join(staticProjectAssetsRoot, project.slug);

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(project.assetDir, targetDir, { recursive: true });
  }
};

const projectAssetsPlugin = (): Plugin => {
  let syncTimer: NodeJS.Timeout | undefined;

  const queueSync = () => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncProjectAssets, 50);
  };

  const shouldSync = (file: string) => {
    const resolved = path.resolve(file);

    return (
      resolved.startsWith(`${contentRoot}${path.sep}`) &&
      (resolved.includes(`${path.sep}assets${path.sep}`) ||
        resolved.endsWith(`${path.sep}project.yml`))
    );
  };

  const onContentChange = (file: string) => {
    if (shouldSync(file)) queueSync();
  };

  return {
    name: "slides-project-assets",
    buildStart: syncProjectAssets,
    configureServer(server) {
      syncProjectAssets();
      server.watcher.add(contentRoot);
      server.watcher.on("add", onContentChange);
      server.watcher.on("change", onContentChange);
      server.watcher.on("unlink", onContentChange);
    },
  };
};

// Generate IIIF on build?
// https://stackoverflow.com/questions/75962259/how-to-launch-a-command-at-the-start-of-each-vite-build
export default defineConfig({
  plugins: [projectAssetsPlugin(), tailwindcss(), sveltekit()],
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
      $content: path.resolve("./content"),
    },
  },
  server: {
    fs: {
      allow: [contentRoot],
    },
  },
});
