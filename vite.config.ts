import { sveltekit } from "@sveltejs/kit/vite";
import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { parse } from "yaml";

const contentRoot = path.resolve("content");
const staticProjectAssetsRoot = path.resolve("static", "assets");

type ProjectAssetManifest = {
  id?: string;
  slug?: string;
};

const getProjectSlug = (projectDir: string, fallback: string) => {
  const manifestPath = path.join(projectDir, "project.yml");
  const manifest = parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as ProjectAssetManifest | null;

  return manifest?.slug ?? manifest?.id ?? fallback;
};

const syncProjectAssets = () => {
  fs.rmSync(staticProjectAssetsRoot, { recursive: true, force: true });

  if (!fs.existsSync(contentRoot)) return;

  for (const dirent of fs.readdirSync(contentRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;

    const projectDir = path.join(contentRoot, dirent.name);
    const manifestPath = path.join(projectDir, "project.yml");
    const assetDir = path.join(projectDir, "assets");

    if (!fs.existsSync(manifestPath) || !fs.existsSync(assetDir)) continue;

    const projectSlug = getProjectSlug(projectDir, dirent.name);
    const targetDir = path.join(staticProjectAssetsRoot, projectSlug);

    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.cpSync(assetDir, targetDir, { recursive: true });
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
