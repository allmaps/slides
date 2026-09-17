import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { loadSlidesConfig, getAppEnvironment } from "../src/config.ts";

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
