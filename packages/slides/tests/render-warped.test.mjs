import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { generateAnnotation } from "@allmaps/annotation";
import { resolveChapterCamera } from "@allmaps/slides/model/map/camera";
import { createSourceContext } from "@allmaps/static-render/context";
import { loadLayer } from "../src/build/layers.ts";
import { renderBatch } from "@allmaps/static-render";

test("local IIIF sources, projective transforms and changed originals survive the package boundary", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "static-warped-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const filename = path.join(root, "map.png");
  const writeImage = (background) =>
    sharp({ create: { width: 64, height: 64, channels: 3, background } })
      .png()
      .toFile(filename);
  await writeImage("#ff0000");
  const map = {
    "@context": "https://schemas.allmaps.org/map/2/context.json",
    type: "GeoreferencedMap",
    resource: {
      id: "https://old.example.org/previous/iiif/map",
      type: "ImageService3",
      width: 64,
      height: 64,
    },
    resourceMask: [
      [0, 0],
      [64, 0],
      [64, 64],
      [0, 64],
    ],
    gcps: [
      { resource: [0, 0], geo: [4.91, 52.38] },
      { resource: [64, 0], geo: [4.92, 52.38] },
      { resource: [64, 64], geo: [4.92, 52.374] },
      { resource: [0, 64], geo: [4.91, 52.374] },
    ],
    transformation: { type: "projective" },
  };
  await writeFile(
    path.join(root, "map.json"),
    JSON.stringify(generateAnnotation(map)),
  );
  const assets = {
    images: { "https://new.example.org/atlas/iiif/map": "map.png" },
    data: { "/assets/map.json": "map.json" },
  };
  const options = {
    assetRoot: root,
    cacheRoot: path.join(root, "cache"),
    outputRoot: path.join(root, "out"),
    offline: true,
  };
  const context = await createSourceContext({ ...options, assets, epoch: 0 });
  const props = {
    url: "/assets/map.json",
    options: { transformationType: "projective" },
  };
  const layer = await loadLayer(props, context.annotations, context.sources);
  t.after(() => layer.maps.forEach((map) => map.destroy()));
  assert.equal(
    layer.maps[0].georeferencedMap.transformation.type,
    "projective",
  );
  assert.equal(layer.maps[0].mapOptions.transformationType, "projective");
  assert.equal(props.options.transformationType, "projective");
  const camera = resolveChapterCamera(
    { warpedMaps: [props] },
    () => layer.maps,
    [48, 48],
    4,
  );
  const plan = {
    version: 2,
    epoch: 0,
    assets,
    resources: {},
    layers: {
      map: {
        effects: props.options,
        maps: layer.maps.map((map) => ({
          map: map.georeferencedMap,
          options: map.mapOptions,
        })),
      },
    },
    jobs: [
      { id: "map", layers: ["map"], camera, size: [48, 48], format: "webp" },
    ],
  };
  const first = await renderBatch(plan, options);
  const { data, info } = await sharp(
    path.join(options.outputRoot, first.images.map.path),
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const center = (24 * info.width + 24) * 4;
  assert(data[center] > 240 && data[center + 3] > 240);
  assert.equal(data[3], 0);
  await writeImage("#0000ff");
  const changed = await renderBatch(plan, options);
  assert.notEqual(
    changed.images.map.path,
    first.images.map.path,
    "An unchanged plan must not hide a changed local original",
  );

  const centerPixel = async result => {
    const bytes = await sharp(path.join(options.outputRoot, result.images.map.path)).ensureAlpha().raw().toBuffer();
    return [...bytes.subarray(center, center + 4)];
  };
  const messages = [];
  t.mock.method(console, 'warn', message => messages.push(message));
  const styled = await loadLayer({ ...props, options: {
    ...props.options, colorize: true, colorizeColor: '#00ff00', opacity: 0.5,
    renderMask: true, renderGrid: true, debugTriangles: true,
  } }, context.annotations, context.sources);
  t.after(() => styled.maps.forEach(map => map.destroy()));
  assert.match(messages[0], /map.json.*renderMask.*renderGrid.*debugTriangles/);
  plan.layers.map.effects = styled.effects;
  const colored = await renderBatch(plan, options);
  const cyan = await centerPixel(colored);
  assert.ok(cyan[0] < 10 && cyan[1] > 240 && cyan[2] > 240);
  assert.equal(cyan[3], 128);
  assert.deepEqual(await renderBatch(plan, options), colored, 'effects survive a warm cache');
  plan.layers.map.effects = { removeColor: true, removeColorColor: '#0000ff' };
  const removed = await renderBatch(plan, options);
  assert.equal((await centerPixel(removed))[3], 0);
  assert.notEqual(removed.images.map.path, colored.images.map.path);
  plan.layers.below = structuredClone(plan.layers.map);
  plan.layers.below.effects = { colorize: true, colorizeColor: '#00ff00' };
  plan.jobs[0].layers = ['below', 'map'];
  const revealed = await centerPixel(await renderBatch(plan, options));
  assert.ok(revealed[0] < 10 && revealed[1] > 240 && revealed[2] > 240 && revealed[3] === 255,
    'removed paper must reveal the map below, not cover it with an opaque color');
  delete plan.layers.below;
  plan.jobs[0].layers = ['map'];

  // A standalone plan can specify effects on an individual map, too.
  delete plan.layers.map.effects;
  Object.assign(plan.layers.map.maps[0].options, {
    colorize: true, colorizeColor: '#ff0000', renderAppliedMask: true,
  });
  const magenta = await centerPixel(await renderBatch(plan, options));
  assert.ok(magenta[0] > 240 && magenta[1] < 10 && magenta[2] > 240);
  assert.ok(messages.some(message => /old.example.org.*renderAppliedMask/.test(message)));
  for (const flag of ['visible', 'renderMaps']) {
    plan.layers.map.maps[0].options[flag] = false;
    assert.equal((await centerPixel(await renderBatch(plan, options)))[3], 0);
    delete plan.layers.map.maps[0].options[flag];
  }

  // An option mask excludes the center; disabling masking must restore it.
  plan.layers.map.maps[0].options.resourceMask = [[0, 0], [12, 0], [12, 12], [0, 12]];
  assert.equal((await centerPixel(await renderBatch(plan, options)))[3], 0);
  plan.layers.map.maps[0].options.applyMask = false;
  assert.equal((await centerPixel(await renderBatch(plan, options)))[3], 255);
});
