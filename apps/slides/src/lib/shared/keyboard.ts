export type SlideshowShortcut = 'next' | 'previous' | 'back' | 'togglePanel';

export function slideshowShortcut(event: {
  key: string; altKey?: boolean; ctrlKey?: boolean; metaKey?: boolean;
  shiftKey?: boolean; defaultPrevented?: boolean; blocked?: boolean;
}): SlideshowShortcut | undefined {
  if (event.defaultPrevented || event.blocked || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (event.key === 'ArrowRight') return 'next';
  if (event.key === 'ArrowLeft') return 'previous';
  if (event.key.toLowerCase() === 'b') return 'back';
  if (event.key.toLowerCase() === 'h') return 'togglePanel';
}
