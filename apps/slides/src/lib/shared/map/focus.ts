import { isTextEntry, slideshowShortcut } from '../keyboard.ts';

/** Wheel gestures leave focus on the previous control; clicking uses native focus. */
export function focusMapOnWheel(canvas: HTMLCanvasElement) {
  const wheel = (event: WheelEvent) => {
    // Wheel zoom does not normally transfer keyboard focus. Preserve typing and
    // browser shortcuts, but release focus held by a map or navigation button.
    // Ctrl+wheel is included because MapLibre uses it for trackpad pinch zoom.
    if (event.defaultPrevented || event.metaKey || event.altKey || !(event.deltaX || event.deltaY)) return;
    const target = canvas.ownerDocument.activeElement ?? undefined;
    if (isTextEntry(target) || slideshowShortcut({ key: ' ', target })) return;
    canvas.focus({ preventScroll: true });
  };

  // Listen on the canvas itself so controls and overlays retain their focus.
  canvas.addEventListener('wheel', wheel, { passive: true });
  return () => {
    canvas.removeEventListener('wheel', wheel);
  };
}
