import { isPanelScrollKey, isTextEntry } from './keyboard.ts';

/** Keep reading gestures separate from control activation and slideshow shortcuts. */
export function panelScroll(element: HTMLElement, onInterrupt: () => void) {
  const targetElement = (event: Event) =>
    event.target && 'closest' in event.target ? event.target as Element : undefined;

  const wheel = (event: WheelEvent) => {
    // Ctrl+wheel is also used for trackpad pinch-to-zoom.
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || !event.deltaY) return;
    const target = targetElement(event);
    if (isTextEntry(target)) return;
    onInterrupt();
    // Wheel scrolling does not move browser focus. A previously clicked map
    // or navigation button would otherwise keep receiving Space indefinitely.
    if (!isTextEntry(element.ownerDocument.activeElement)) element.focus({ preventScroll: true });
  };
  const pointerdown = () => onInterrupt();
  const keydown = (event: KeyboardEvent) => {
    const target = targetElement(event);
    if (isPanelScrollKey({ key: event.key, target,
      defaultPrevented: event.defaultPrevented, shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey,
      isComposing: event.isComposing })) onInterrupt();
  };

  element.addEventListener('wheel', wheel, { passive: true });
  element.addEventListener('pointerdown', pointerdown, { passive: true });
  element.addEventListener('keydown', keydown);
  return {
    update(callback: typeof onInterrupt) { onInterrupt = callback; },
    destroy() {
      element.removeEventListener('wheel', wheel);
      element.removeEventListener('pointerdown', pointerdown);
      element.removeEventListener('keydown', keydown);
    },
  };
}
