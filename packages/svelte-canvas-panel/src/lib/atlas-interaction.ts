import { BrowserEventManager, type Runtime } from "@atlas-viewer/atlas/standalone";

/** Atlas 3.2.4's stopTransition() leaves commands that resize() can resume. */
export function cancelAtlasMotion(runtime: Runtime) {
  const motion = runtime.transitionManager;
  motion.stopTransition();
  motion.lastZoomTo = null;
  motion.lastGoToRegion = null;
  motion.isConstraining = false;
  motion.pendingTransition.callback = undefined;
  motion.pendingTransition.constrain = false;
}

/** Keep one context-menu handler for the canvas, including its initial preview. */
export function createAtlasInteraction(runtime: Runtime, canvas: HTMLCanvasElement) {
  let session = attachAtlasEvents(runtime, canvas, false);
  session.stop();
  let active = false;
  let destroyed = false;

  return {
    start() {
      if (active || destroyed) return;
      // Each event manager owns its subscriptions. Replace the stopped manager
      // on reopening, including its retained context-menu handler.
      session.destroy();
      session = attachAtlasEvents(runtime, canvas, true);
      active = true;
    },
    stop() {
      session.stop();
      active = false;
    },
    updateBounds() { session.updateBounds(); },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      session.destroy();
      active = false;
    },
  };
}

/** Scope zoom/pan listeners and frame hooks to one modal opening. */
function attachAtlasEvents(runtime: Runtime, canvas: HTMLCanvasElement, interactive: boolean) {
  const previousEvents = [...runtime.world.activatedEvents];
  const previousFrameHooks = new Set(runtime.hooks.useFrame);
  const previousBeforeFrameHooks = new Set(runtime.hooks.useBeforeFrame);
  if (interactive) runtime.startControllers();
  const events = new BrowserEventManager(canvas, runtime);
  const frameHooks = runtime.hooks.useFrame.filter(hook => !previousFrameHooks.has(hook));
  const beforeFrameHooks = runtime.hooks.useBeforeFrame.filter(hook => !previousBeforeFrameHooks.has(hook));
  let active = true;

  const stop = () => {
    if (!active) return;
    active = false;
    runtime.stopControllers();
    events.stop();

    // Retain Atlas's context-menu handling in the preview. Frame hooks belong
    // to interaction and must be removed along with its zoom/pan listeners.
    runtime.hooks.useFrame = runtime.hooks.useFrame.filter(hook => !frameHooks.includes(hook));
    runtime.hooks.useBeforeFrame = runtime.hooks.useBeforeFrame.filter(hook => !beforeFrameHooks.includes(hook));
    runtime.world.activatedEvents = previousEvents;
    events.pointerMoveEvent = undefined;
    // Its delayed pointer-down callbacks must not start a drag after closing.
    events.pointerEventState.isPressed = false;
    events.pointerEventState.isClicking = false;
    events.pointerEventState.isDragging = false;
    events.pointerEventState.mousedOver = [];
    events.pointerEventState.itemsBeingDragged = [];
    events.pointerEventState.lastTouches = [];

    // Drain queued input while the interactive subscribers are detached.
    runtime.world.flushSubscriptions();
    cancelAtlasMotion(runtime);
  };
  return {
    stop,
    updateBounds: () => events.updateBounds(),
    destroy() {
      stop();
      canvas.removeEventListener("contextmenu", events.onContextMenu);
    },
  };
}
