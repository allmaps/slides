import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { loadSlidesConfig, getAppEnvironment } from "../src/content/config.ts";
import { getEffectiveBasemapStyleConfig, resolveBasemapStyle } from "../src/model/basemap.ts";

test("an environment key enables Protomaps without a map block", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-basemap-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "slides.config.yml"), "title: Map\n");
  for (const key of ["", "environment-key"]) {
    const config = await loadSlidesConfig({ content: root, publicOverrides: { PUBLIC_PROTOMAPS_KEY: key } });
    const style = await resolveBasemapStyle({ theme: "light", config: getEffectiveBasemapStyleConfig({
      theme: "light", appMap: config.slidesConfig.map, appProtomaps: config.slidesConfig.protomaps,
    }) });
    assert.equal(getAppEnvironment(config).PUBLIC_PROTOMAPS_KEY, key);
    if (key) assert.equal(style.sources["basemap:protomaps"].url, "https://api.protomaps.com/tiles/v4.json?key=environment-key");
    else assert.deepEqual(style.sources, {});
  }
  await writeFile(path.join(root, "slides.config.yml"), 'title: Map\nprotomaps:\n  key: ""\n');
  assert.equal((await loadSlidesConfig({ content: root,
    publicOverrides: { PUBLIC_PROTOMAPS_KEY: "environment-key" },
  })).protomapsKey, "environment-key");
});

test("generation defaults, IIIF options, and config reloads preserve only explicit environment overrides", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-generation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filename = path.join(root, "slides.config.json");
  await writeFile(filename, JSON.stringify({ title: "Images" }));
  const config = await loadSlidesConfig({ content: root, thumbnailsEnabledOverride: null });
  assert.equal(config.iiif.enabled, true);
  assert.equal(config.thumbnails.enabled, true);
  await writeFile(filename, JSON.stringify({ iiif: { enabled: false, force: true, input: "photos", output: "export",
    id: "https://images.example.org", collectionLabel: "Archive", tiles: false, sizes: false, webp: false, tileSize: 512 }, thumbnails: { enabled: false } }));
  // Vite inherits its own environment between restarts; that must not freeze YAML values.
  const before = process.env.SLIDES_THUMBNAILS_ENABLED;
  t.after(() => { if (before === undefined) delete process.env.SLIDES_THUMBNAILS_ENABLED; else process.env.SLIDES_THUMBNAILS_ENABLED = before; });
  process.env.SLIDES_THUMBNAILS_ENABLED = "true";
  const changed = await loadSlidesConfig(config.options);
  assert.equal(changed.thumbnails.enabled, false);
  assert.deepEqual(changed.iiif, { enabled: false, force: true, inputRoot: path.join(config.rootDir, "photos"),
    outputRoot: path.join(config.rootDir, "export"), idBase: "https://images.example.org", collectionLabel: "Archive",
    tiles: false, sizes: false, webp: false, tileSize: "512" });
  assert.equal(getAppEnvironment(changed).PUBLIC_SLIDES_IIIF_ENABLED, "false");
  assert.equal(getAppEnvironment(changed).SLIDES_THUMBNAILS_ENABLED, "false");
  assert.equal((await loadSlidesConfig({ ...config.options, thumbnailsEnabledOverride: "true" })).thumbnails.enabled, true);
});

test("development modules stay outside node_modules without moving generated image caches", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-dev-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "slides.config.yml"), "title: Fixture\n");
  const dev = await loadSlidesConfig({ content: root, cwd: root, mode: "development" });
  const production = await loadSlidesConfig({ content: root, cwd: root, mode: "production" });
  assert.ok(!dev.workDir.split(path.sep).includes("node_modules"));
  assert.equal(dev.cacheDir, production.cacheDir);
  assert.equal(dev.projectDir, production.projectDir);
  assert.equal(dev.projectKey, production.projectKey);
  const custom = await loadSlidesConfig({ content: root, cwd: root, mode: "development", cacheDir: "cache" });
  assert.equal(custom.workDir, path.join(custom.projectDir, "development"));
});

test("deployment URL and root-path overrides take precedence without rewriting content", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-config-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const before = {
    PUBLIC_URL: process.env.PUBLIC_URL,
    PUBLIC_BASE_PATH: process.env.PUBLIC_BASE_PATH,
  };
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      name: "fixture-content",
      type: "module",
      exports: "./index.ts",
    }),
  );
  await writeFile(path.join(root, "index.ts"), "export {};");
  const configPath = path.join(root, "slides.config.yml");
  await writeFile(
    configPath,
    "title: Fixture\nsite:\n  basePath: /pages\n  publicUrl: https://example.org/pages/\n",
  );
  delete process.env.PUBLIC_URL;
  delete process.env.PUBLIC_BASE_PATH;
  const original = await loadSlidesConfig({ configPath });
  assert.equal(original.publicBasePath, "/pages");
  assert.equal(original.publicUrl, "https://example.org/pages/");
  process.env.PUBLIC_BASE_PATH = "";
  process.env.PUBLIC_URL = "https://atlas.example.org/";
  const deployed = await loadSlidesConfig({ configPath });
  assert.equal(deployed.publicBasePath, "");
  assert.equal(
    getAppEnvironment(deployed).PUBLIC_URL,
    "https://atlas.example.org/",
  );
  process.env.PUBLIC_URL = "";
  assert.equal(
    (await loadSlidesConfig({ configPath })).publicUrl,
    original.publicUrl,
  );
});
