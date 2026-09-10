import assert from "node:assert/strict";
import { test } from "node:test";
import { Runtime, World, popmotionController } from "@atlas-viewer/atlas/standalone";
import { cancelAtlasMotion, createAtlasInteraction } from "../src/lib/atlas-interaction.ts";

// Real Atlas runtime/controllers, with a headless renderer and counted DOM targets.
class TrackedTarget extends EventTarget {
  listeners = new Map();
  dataset = {};
  width = 1000;
  height = 800;
  addEventListener(type, listener, options) {
    const key = `${type}:${Boolean(typeof options === "boolean" ? options : options?.capture)}`;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(listener);
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    const key = `${type}:${Boolean(typeof options === "boolean" ? options : options?.capture)}`;
    this.listeners.get(key)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((n, set) => n + set.size, 0); }
  getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, width: this.width, height: this.height }; }
}

function fixture(t) {
  const canvas = new TrackedTarget();
  const windowTarget = new TrackedTarget();
  windowTarget.requestAnimationFrame = () => 1;
  windowTarget.cancelAnimationFrame = () => {};
  windowTarget.setTimeout = setTimeout;
  windowTarget.clearTimeout = clearTimeout;
  const previousWindow = globalThis.window;
  globalThis.window = windowTarget;
  const renderer = {
    beforeFrame() {}, paint() {}, afterFrame() {}, prepareLayer() {}, finishLayer() {}, afterPaintLayer() {}, reset() {},
    getScale: (width, height) => Math.min(canvas.width / width, canvas.height / height),
    pendingUpdate: () => false, isReady: () => true, getViewportBounds: () => null,
    getRendererScreenPosition: () => canvas.getBoundingClientRect(),
    getPointsAt: (world, target, aggregate, scale) => world.getPointsAt(target, aggregate, scale),
    resize(width, height) { canvas.width = width; canvas.height = height; },
  };
  const world = new World(9342, 7100);
  const runtime = new Runtime(renderer, world, { width: 1000, height: 800, x: 0, y: 0, scale: 1 });
  runtime.stopControllers();
  runtime.addController(popmotionController({ parentElement: canvas, maxZoomFactor: 3, enableHoldToHome: false }));
  runtime.goHome();
  const interaction = createAtlasInteraction(runtime, canvas);
  t.after(() => {
    interaction.destroy();
    runtime.stopControllers();
    runtime.stop();
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  return { canvas, windowTarget, world, runtime, interaction };
}

function counts({ canvas, windowTarget, world, runtime }) {
  return {
    canvas: canvas.listenerCount, window: windowTarget.listenerCount,
    world: Object.values(world.eventHandlers).reduce((n, handlers) => n + handlers.length, 0),
    subscribers: world.subscriptions.length,
    hooks: Object.fromEntries(Object.entries(runtime.hooks).map(([name, hooks]) => [name, hooks.length])),
    activated: [...world.activatedEvents],
  };
}
const pointer = type => Object.assign(new Event(type, { cancelable: true }), { clientX: 100, clientY: 100, button: 0 });

for (const completed of [false, true]) {
  test(`closing after ${completed ? "completed" : "interrupted"} zoom restores the region through subsequent frames and resizes`, t => {
    const { runtime, world, interaction } = fixture(t);
    interaction.start();
    world.zoomIn();
    world.flushSubscriptions();
    runtime.render(runtime.lastTime + (completed ? 5000 : 30));
    if (completed) runtime.render(runtime.lastTime + 5000);
    assert.ok(runtime.transitionManager.lastZoomTo, "fixture exercises Atlas's saved zoom command");
    interaction.stop();
    const preview = { x: 1700, y: 1200, width: 5900, height: 4550 };
    for (const [fromWidth, width, fromHeight, height] of [[1000, 590, 800, 455], [590, 295, 455, 227.5]]) {
      runtime.resize(fromWidth, width, fromHeight, height);
      runtime.setViewport(preview);
      runtime.render(runtime.lastTime + 16);
      runtime.render(runtime.lastTime + 5000);
      assert.deepEqual({ ...runtime.getViewport() }, preview);
      assert.equal(runtime.transitionManager.hasPending(), false);
    }
  });
}

test("preview retains exactly one context-menu listener while each modal cycle cleans up interaction", t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const state = fixture(t);
  const { canvas, windowTarget, world, runtime, interaction } = state;
  // The preview's own activation listeners and unrelated hooks must survive.
  canvas.addEventListener("click", () => {});
  canvas.addEventListener("keydown", () => {});
  runtime.registerHook("useFrame", () => {});
  const baseline = counts(state);
  assert.equal(canvas.listeners.get("contextmenu:false")?.size, 1);
  assert.equal(canvas.dispatchEvent(new Event("contextmenu", { cancelable: true })), false);
  const propagate = t.mock.method(world, "propagatePointerEvent");
  for (let cycle = 0; cycle < 5; cycle++) {
    interaction.start();
    const opened = counts(state);
    interaction.start();
    assert.deepEqual(counts(state), opened, "starting twice does not add listeners");
    assert.ok(canvas.listenerCount > baseline.canvas);
    assert.ok(windowTarget.listenerCount > 0);
    assert.equal(canvas.dispatchEvent(new Event("contextmenu", { cancelable: true })), false);
    canvas.dispatchEvent(pointer("pointerdown"));
    canvas.dispatchEvent(pointer("pointermove"));
    world.zoomIn(); // Also cancel an input still queued for the next frame.
    interaction.stop();
    interaction.stop(); // Cleanup is safe on either dialog close or component destruction.
    const callsAfterStop = propagate.mock.callCount();
    t.mock.timers.tick(1000);
    windowTarget.dispatchEvent(pointer("mouseup"));
    windowTarget.dispatchEvent(pointer("mousemove"));
    assert.equal(canvas.dispatchEvent(new Event("contextmenu", { cancelable: true })), false);
    assert.equal(canvas.dispatchEvent(new Event("wheel", { cancelable: true })), true);
    runtime.render(runtime.lastTime + 1000);
    assert.equal(propagate.mock.callCount(), callsAfterStop);
    assert.deepEqual(counts(state), baseline);
    assert.equal(runtime.transitionManager.hasPending(), false);
  }
  interaction.destroy();
  interaction.destroy();
  assert.equal(canvas.listeners.get("contextmenu:false")?.size, 0);
  assert.equal(canvas.dispatchEvent(new Event("contextmenu", { cancelable: true })), true);
  assert.deepEqual(counts(state), { ...baseline, canvas: baseline.canvas - 1 });
});

test("destroying an open viewer removes its retained context-menu handler and interaction", t => {
  const state = fixture(t);
  const baseline = counts(state);
  state.interaction.start();
  state.interaction.destroy();
  state.interaction.start(); // A destroyed canvas cannot reinstall listeners.
  assert.deepEqual(counts(state), { ...baseline, canvas: baseline.canvas - 1 });
  assert.equal(state.canvas.dispatchEvent(new Event("contextmenu", { cancelable: true })), true);
  assert.equal(state.canvas.dispatchEvent(new Event("wheel", { cancelable: true })), true);
});

test("returning to the preview cancels saved region and constraint commands as well as zoom", t => {
  const { runtime } = fixture(t);
  runtime.transitionManager.goToRegion({ x: 100, y: 100, width: 200, height: 200 });
  runtime.transitionManager.isConstraining = true;
  cancelAtlasMotion(runtime);
  runtime.transitionManager.resumeTransition();
  assert.equal(runtime.transitionManager.hasPending(), false);
  assert.equal(runtime.transitionManager.lastGoToRegion, null);
  assert.equal(runtime.transitionManager.isConstraining, false);
});
