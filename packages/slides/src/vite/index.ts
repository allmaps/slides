import path from "node:path";
import { watch } from "node:fs";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Plugin, ViteDevServer } from "vite";
import { prepareIiif, iiifCatalogPath } from "../build/iiif.ts";
import { thumbnailPaths } from "../build/thumbnails.ts";
import { getAppEnvironment, loadRuntimeConfig, type RuntimeSlidesConfig } from "../content/config.ts";
import { loadContent, slash, within, type ContentSnapshot } from "../content/index.ts";
import { normalizeBasePath } from "../content/assets.ts";

export const CONTENT_MODULE = "virtual:slides/content";
const id = `\0${CONTENT_MODULE}`;
const markdownId = "virtual:slides/markdown";
const catalogId = "virtual:slides/iiif-server";
export function contentModule(content: ContentSnapshot) {
  const lines = [`export const slidesConfig = ${JSON.stringify(content.config.slidesConfig)};`, `export const project = ${JSON.stringify(content.project)};`];
  const record = (name: string, files: string[], query: string, eager = true) => {
    const entries = files.map((filename, index) => {
      const key = `./${within(content.config.sourceContentDir, filename)}`;
      const specifier = JSON.stringify(slash(filename) + query);
      const local = `${name}_${index}`;
      if (eager) lines.push(`import ${local} from ${specifier};`);
      return `${JSON.stringify(key)}: ${eager ? local : `() => import(${specifier}).then(m => m.default)`}`;
    });
    lines.push(`export const ${name} = {${entries.join(",")}};`);
  };
  record("dataAssetFiles", content.data, "?raw", false);
  record("imageAssetUrls", content.images, content.config.iiif.enabled ? "?url&iiif" : "?url");
  lines.push(`export const mapStyleFiles = ${JSON.stringify(content.styles)};`);
  return lines.join("\n");
}

// Markdown components can import config/assets. Keeping them separate avoids
// a circular dependency between their layout and the content registry.
export function markdownModule(content: ContentSnapshot) {
  const entries = Object.entries(content.slides);
  const credits = Object.entries(content.credits);
  return entries.map(([, slide], index) => `import * as slide${index} from ${JSON.stringify(slash(slide.filename))};`).join("\n")
    + `\nexport const slideFiles = {${entries.map(([source], index) => `${JSON.stringify(source)}: slide${index}`).join(",")}};`
    + "\n" + credits.map(([, credit], index) => `import credit${index} from ${JSON.stringify(slash(credit.filename))};`).join("\n")
    + `\nexport const creditsFiles = {${credits.map(([showId], index) => `${JSON.stringify(showId)}: credit${index}`).join(",")}};`
    + (content.sharedCredits ? `\nimport sharedCredit from ${JSON.stringify(slash(content.sharedCredits.filename))};\nexport const sharedCreditsFile = sharedCredit;` : "\nexport const sharedCreditsFile = undefined;");
}

export function slidesContent(): Plugin {
  let runtime: RuntimeSlidesConfig;
  let prepared: Promise<string> | undefined;
  let cleanup = () => {};
  const invalidate = (server: ViteDevServer) => {
    server.moduleGraph.invalidateAll();
    server.ws.send({ type: "full-reload" });
  };
  return {
    name: "slides-content",
    async config() {
      runtime = await loadRuntimeConfig();
      return {
        cacheDir: path.join(runtime.workDir, "vite"),
        server: { fs: { allow: [runtime.appDir, runtime.sourceContentDir, path.resolve(runtime.appDir, "../..")] },
          watch: { ignored: [runtime.cacheDir + "/**", runtime.outDir + "/**"] } },
      };
    },
    resolveId(source) {
      if (source === CONTENT_MODULE) return id;
      if (source === markdownId) return `\0${markdownId}`;
      if (source === catalogId) return `\0${catalogId}`;
    },
    async load(source) {
      if (source === `\0${catalogId}`) {
        return `import { readIiifCatalog } from ${JSON.stringify(fileURLToPath(import.meta.resolve("@allmaps/iiif/catalog")))}; export default readIiifCatalog(${JSON.stringify(iiifCatalogPath(runtime))});`;
      }
      if (source !== id && source !== `\0${markdownId}`) return;
      const content = await loadContent(runtime);
      this.addWatchFile(content.config.configPath);
      for (const file of [...Object.values(content.slides).map(s => s.filename), ...Object.values(content.credits).map(c => c.filename), ...(content.sharedCredits ? [content.sharedCredits.filename] : []), ...content.images, ...content.data]) this.addWatchFile(file);
      return source === id ? contentModule(content) : markdownModule(content);
    },
    async configureServer(server) {
      const root = runtime.sourceContentDir;
      server.watcher.add([root, runtime.configPath]);
      server.middlewares.use(async (req, _res, next) => {
        const base = normalizeBasePath(runtime.publicBasePath);
        const prefix = `/${base ? base + "/" : ""}iiif/`;
        if (!req.url?.split("?")[0].startsWith(prefix)) return next();
        try {
          const origin = `${server.config.server.https ? "https" : "http"}://${req.headers.host ?? "localhost"}`;
          prepared ??= prepareIiif(runtime, origin + (base ? "/" + base : "")).catch(error => { prepared = undefined; throw error; });
          await prepared;
          next();
        } catch (error) { next(error as Error); }
      });
      const changed = new Set<string>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      let running = Promise.resolve();
      const flush = async () => {
        if (closed) return;
        const files = [...changed]; changed.clear();
        prepared = undefined;
        try {
          const next = await loadRuntimeConfig();
          await loadContent(next);
          if (files.includes(runtime.configPath)) {
            Object.assign(process.env, getAppEnvironment(next));
            const thumbnails = thumbnailPaths(next);
            Object.assign(process.env, { SLIDES_THUMBNAILS_MANIFEST: thumbnails.manifestPath, SLIDES_THUMBNAILS_ASSETS: thumbnails.outputRoot });
            await server.restart();
          } else invalidate(server);
        } catch (error) {
          server.ws.send({ type: "error", err: { message: String(error), stack: "", plugin: "slides-content" } });
          server.config.logger.error(String(error));
        }
      };
      const onChange = (_event: string, filename: string) => {
        if (closed || (filename !== runtime.configPath && !filename.startsWith(root + path.sep))) return;
        const parts = path.relative(root, filename).split(path.sep);
        if (parts.some(part => ["node_modules", ".git", "dist", "build"].includes(part))) return;
        if (filename.startsWith(runtime.outDir + path.sep) || filename.startsWith(runtime.cacheDir + path.sep)) return;
        changed.add(filename);
        clearTimeout(timer);
        timer = setTimeout(() => { running = running.then(flush); }, 60);
      };
      server.watcher.on("all", onChange);
      // Vite ignores its cache. Observe only the completed thumbnail manifest,
      // so an explicit external command can refresh the view without a sync loop.
      const thumbnails = thumbnailPaths(runtime);
      await mkdir(thumbnails.work, { recursive: true });
      const manifestWatcher = watch(thumbnails.work, { persistent: false }, (_event, filename) => {
        if (filename === "manifest.json" && !closed) invalidate(server);
      });
      cleanup = () => {
        closed = true; clearTimeout(timer);
        server.watcher.off("all", onChange); manifestWatcher.close();
      };
      server.httpServer?.once("close", () => cleanup());
    },
    closeBundle() { cleanup(); },
  };
}
