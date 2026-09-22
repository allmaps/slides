import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { renderBatch, validateRenderPlan } from "../src/index.ts";

const emptyPlan = () => ({
  version: 2,
  epoch: 0,
  assets: { images: {}, data: {} },
  layers: {},
  resources: {},
  jobs: [
    {
      id: "blank",
      layers: [],
      camera: { center: [0, 0], zoom: 1, bearing: 0 },
      size: [16, 16],
      format: "webp",
    },
  ],
});
test("standalone batch publishes immutable outputs and supports offline cache reuse", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "static-render-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = {
    assetRoot: root,
    cacheRoot: path.join(root, "cache"),
    outputRoot: path.join(root, "out"),
    offline: true,
  };
  const plan = emptyPlan();
  plan.resources.annotation = {
    base64: Buffer.from('{"test":true}').toString("base64"),
    extension: "json",
  };
  const first = await renderBatch(plan, options),
    second = await renderBatch(plan, options);
  assert.deepEqual(first, second);
  assert.match(first.images.blank.path, /^[a-f0-9]{64}\.webp$/);
  assert.equal(
    await readFile(
      path.join(options.outputRoot, first.resources.annotation),
      "utf8",
    ),
    '{"test":true}',
  );
});
test("invalid jobs fail before rendering and local inputs stay rooted", () => {
  const plan = emptyPlan();
  plan.jobs.push(plan.jobs[0]);
  assert.throws(() => validateRenderPlan(plan), /Duplicate/);
  const missing = emptyPlan();
  missing.jobs[0].layers = ["unknown"];
  assert.throws(() => validateRenderPlan(missing), /Unknown render layer/);
  const escaped = emptyPlan();
  escaped.assets.images.image = "../outside.jpg";
  assert.throws(() => validateRenderPlan(escaped), /relative/);
});
