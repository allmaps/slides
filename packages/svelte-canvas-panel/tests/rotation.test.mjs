import assert from "node:assert/strict";
import { test } from "node:test";
import { canvasRotation } from "../src/lib/rotation.ts";
import { createIiifWorld } from "../src/lib/atlas-world.ts";

const resource = {
  width: 1200, height: 400,
  images: [{ id: "https://example.org/image.jpg", width: 1200, height: 400,
    target: { x: 0, y: 0, width: 1200, height: 400 } }],
};

test("clockwise rotation preserves crop coordinates and swaps quarter-turn proportions", () => {
  const view = canvasRotation(resource, 90);
  assert.equal(view.width, 400);
  assert.equal(view.height, 1200);
  assert.deepEqual(view.bounds({ x: 100, y: 50, width: 300, height: 200 }),
    { x: 150, y: 100, width: 200, height: 300 });
  assert.deepEqual(canvasRotation(resource, -90).bounds(resource.images[0].target),
    { x: 0, y: 0, width: 400, height: 1200 });
  assert.equal(canvasRotation(resource, 450).rotation, 90);
  assert.equal(canvasRotation(resource, NaN).rotation, 0);
});

test("arbitrary angles fit the complete canvas and preserve positioned-image centers", () => {
  const view = canvasRotation({ width: 100, height: 100 }, 45);
  assert.ok(Math.abs(view.width - Math.sqrt(2) * 100) < 1e-8);
  const box = { x: 10, y: 20, width: 30, height: 40 };
  const placed = view.placement(box);
  const bounds = view.bounds(box);
  assert.ok(Math.abs(placed.x + box.width / 2 - bounds.x - bounds.width / 2) < 1e-8);
  assert.ok(Math.abs(placed.y + box.height / 2 - bounds.y - bounds.height / 2) < 1e-8);
});

test("zooming to either end of a rotated image keeps its layers visible", () => {
  const world = createIiifWorld(resource, 90);
  world.recalculateWorldSize();
  assert.equal(world.width, 400);
  assert.equal(world.height, 1200);
  for (const y of [0, 1100]) {
    const paints = world.getPointsFromViewer({ x: 0, y, width: 100, height: 100, scale: 1 });
    assert.equal(paints.length, 1, `paint at rotated y=${y}`);
    assert.equal(paints[0][0].__owner.value.rotation, 90);
  }
});

test("rotation keeps level 0 tile requests unrotated and available at the rotated edge", async () => {
  const service = { "@context": "http://iiif.io/api/image/3/context.json", id: "https://example.org/image", type: "ImageService3", profile: "level0",
    width: 1200, height: 400, tiles: [{ width: 256, scaleFactors: [1, 2, 4] }] };
  const tiled = { ...resource, images: [{ ...resource.images[0], service }] };
  const world = createIiifWorld(tiled, 90);
  for (const update of world.getScheduledUpdates(new Float32Array([1, 0, 1100, 100, 1200]), 1)) await update();
  const paints = world.getPointsFromViewer({ x: 0, y: 1100, width: 100, height: 100, scale: 1 });
  assert.ok(paints.length);
  const composite = world.getObjects().find(object => object.layers.length).layers[0];
  assert.ok(composite.allImages.every(layer => !layer.getImageUrl || layer.getImageUrl(0).includes('/0/default.jpg')));
});
