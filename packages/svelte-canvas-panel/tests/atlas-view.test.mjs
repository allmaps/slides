import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Runtime, World } from '@atlas-viewer/atlas/standalone';
import { fitImageRegion, imageZoomState, nativeImageScale, settledResize } from '../src/lib/atlas-view.ts';
import { canvasRotation } from '../src/lib/rotation.ts';

function resource(width, height, target = { x: 0, y: 0, width, height }) {
  return { width: target.width, height: target.height, images: [{ width, height, target }] };
}

test('modal fits preserve native resolution, source crops and rotated image proportions', () => {
  const image = resource(300, 200);
  assert.equal(nativeImageScale(image), 1);
  const fitted = fitImageRegion({ x: 0, y: 0, width: 300, height: 200 }, 900, 600, nativeImageScale(image));
  assert.deepEqual(fitted, { x: -300, y: -200, width: 900, height: 600 });
  const crop = fitImageRegion({ x: 50, y: 25, width: 100, height: 50 }, 300, 200, 1);
  assert.deepEqual(crop, { x: -50, y: -50, width: 300, height: 200 });
  const rotated = canvasRotation(image, 90);
  assert.deepEqual(fitImageRegion({ x: 0, y: 0, width: rotated.width, height: rotated.height }, 100, 200, 1),
    { x: 0, y: -50, width: 200, height: 400 });
});

test('a manifest canvas larger than its painting image respects source resolution', () => {
  const image = resource(300, 200, { x: 0, y: 0, width: 1500, height: 1000 });
  assert.equal(nativeImageScale(image), 0.2);
  const view = canvasRotation(image, 90);
  assert.equal(view.width * nativeImageScale(image), 200);
  assert.equal(view.height * nativeImageScale(image), 300);
});

test('the capped canvas keeps real Atlas zoom commands at native size and allows zoom after shrinking', t => {
  const previousWindow = globalThis.window;
  globalThis.window = { requestAnimationFrame: () => 1, cancelAnimationFrame() {} };
  let width = 300, height = 200;
  const renderer = {
    beforeFrame() {}, paint() {}, afterFrame() {}, prepareLayer() {}, finishLayer() {}, afterPaintLayer() {}, reset() {},
    pendingUpdate: () => false, isReady: () => true, getViewportBounds: () => null,
    getPointsAt: (world, target, aggregate, scale) => world.getPointsAt(target, aggregate, scale),
    getScale: (w, h) => Math.max(width / w, height / h),
    getRendererScreenPosition: () => ({ width, height }),
  };
  const runtime = new Runtime(renderer, new World(300, 200), { x: 0, y: 0, width, height, scale: 1 });
  t.after(() => {
    runtime.stop();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const home = { x: 0, y: 0, width: 300, height: 200 };
  const state = () => imageZoomState(runtime.getScaleFactor(), Math.min(width / 300, height / 200), 1);
  runtime.setViewport(fitImageRegion(home, width, height, 1));
  assert.deepEqual(state(), { canZoomIn: false, canZoomOut: false });
  for (const factor of [0.01, 0.8, 1.25, 100]) {
    const zoomed = runtime.getZoomedPosition(factor, {});
    assert.equal(renderer.getScale(zoomed[3] - zoomed[1], zoomed[4] - zoomed[2]), 1);
  }
  width = 150; height = 100;
  runtime.setViewport(fitImageRegion(home, width, height, 1));
  assert.deepEqual(state(), { canZoomIn: true, canZoomOut: false });
  runtime.target.set(runtime.getZoomedPosition(0.01, {}));
  assert.deepEqual(state(), { canZoomIn: false, canZoomOut: true });
  width = 300; height = 200;
  runtime.setViewport(fitImageRegion(home, width, height, 1));
  assert.deepEqual(state(), { canZoomIn: false, canZoomOut: false });
});

test('resize bursts redraw once after settling; modal moves flush immediately and cleanup cancels work', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let redraws = 0;
  const resize = settledResize(() => redraws++);
  for (let i = 0; i < 10; i++) {
    resize.schedule();
    t.mock.timers.tick(100);
  }
  assert.equal(redraws, 0);
  t.mock.timers.tick(100);
  assert.equal(redraws, 1);
  resize.schedule();
  resize.flush();
  assert.equal(redraws, 2);
  t.mock.timers.tick(300);
  assert.equal(redraws, 2);
  resize.schedule();
  resize.cancel();
  t.mock.timers.tick(300);
  assert.equal(redraws, 2);
});
