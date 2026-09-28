import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSlidesConfig } from "../src/content/config.ts";
import { runCachePurgeCommand } from "../src/cli/commands/cache.ts";

test("cache purge separates project and shared caches, and respects dry-run", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-purge-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "slides.config.yml"), "title: Archive\n");
  const options = { content: root, cwd: root };
  const config = await loadSlidesConfig(options);
  const runner = path.join(root, ".slides/projects", config.projectKey);
  const shared = path.join(config.cacheDir, "slides/iiif/images");
  for (const dir of [config.projectDir, runner, shared, path.join(root, "dist")]) await mkdir(dir, { recursive: true });
  await runCachePurgeCommand({ ...options, dryRun: true });
  await stat(config.projectDir);
  await runCachePurgeCommand(options);
  for (const dir of [config.projectDir, runner]) await assert.rejects(stat(dir), { code: "ENOENT" });
  await stat(shared);
  await runCachePurgeCommand({ ...options, all: true });
  await assert.rejects(stat(shared), { code: "ENOENT" });
  await stat(path.join(root, "dist"));
  await stat(path.join(root, "slides.config.yml"));
});

test("cache purge rejects a symlinked cache that contains the content", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-purge-safety-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "slides.config.yml"), "title: Archive\n");
  await mkdir(path.join(root, "cache"));
  await symlink(root, path.join(root, "cache/slides"));
  await assert.rejects(runCachePurgeCommand({ content: root, cwd: root, cacheDir: "cache", all: true }), /Refusing to purge/);
  await stat(path.join(root, "slides.config.yml"));
});
