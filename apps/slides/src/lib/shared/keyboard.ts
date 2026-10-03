export type SlideshowShortcut = 'next' | 'previous' | 'back' | 'togglePanel' | 'hideMaps' | 'closePanel';

const textEntry = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]';
const spaceControls = 'button, summary, [role="button"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role^="menuitem"], [role="option"], [role="slider"]';
const arrowControls = '[role="slider"], [role="spinbutton"], [role="tablist"], [role="listbox"], [role="menu"], [role="menubar"], [role="radiogroup"], [role="tree"], [role="grid"]';

type KeyboardInput = {
  key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean;
  shiftKey?: boolean; defaultPrevented?: boolean; blocked?: boolean;
  isComposing?: boolean; repeat?: boolean;
  target?: Pick<Element, 'closest'>;
};

export function isTextEntry(target?: Pick<Element, 'closest'> | null): boolean {
  return !!target?.closest(textEntry);
}

/** Whether an unhandled key will scroll the reading panel itself. */
export function isPanelScrollKey(event: KeyboardInput): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || isTextEntry(event.target)) return false;
  // Unmodified Space belongs to map comparison, including held-key repeats.
  // Shift+Space retains the browser's native upward scrolling behavior.
  if (event.key === ' ') return !!event.shiftKey && !event.target?.closest(spaceControls);
  if (event.shiftKey || event.target?.closest(arrowControls)) return false;
  return ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key);
}

export function slideshowShortcut(event: KeyboardInput): SlideshowShortcut | undefined {
  if (event.defaultPrevented || event.blocked || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'Escape') return 'closePanel';
  if (isTextEntry(event.target)) return;
  // The map disables its own keyboard controls, so focus there must not block
  // slideshow shortcuts. Links use Enter, leaving Space free for comparison.
  if (event.key === ' ') {
    if (!event.repeat && !event.target?.closest(spaceControls)) return 'hideMaps';
    return;
  }
  if (event.key.startsWith('Arrow') && event.target?.closest(arrowControls)) return;
  if (event.key === 'ArrowRight') return 'next';
  if (event.key === 'ArrowLeft') return 'previous';
  if (event.key.toLowerCase() === 'b') return 'back';
  if (event.key.toLowerCase() === 'h') return 'togglePanel';
}
