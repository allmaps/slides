import assert from 'node:assert/strict';
import { test } from 'node:test';
import { focusMapOnWheel } from '../src/lib/shared/map/focus.ts';
import { slideshowShortcut } from '../src/lib/shared/keyboard.ts';

function targetMatching(selector) {
  return { closest(selectors) {
    return selectors.split(',').some(value => value.trim() === selector) ? this : null;
  } };
}

function setup(focused = targetMatching('button')) {
  const canvas = Object.assign(new EventTarget(), targetMatching('.maplibregl-canvas'));
  const document = { activeElement: focused };
  const focusCalls = [];
  canvas.ownerDocument = document;
  canvas.focus = options => { focusCalls.push(options); document.activeElement = canvas; };
  const cleanup = focusMapOnWheel(canvas);
  const dispatch = (type, props = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), props);
    canvas.dispatchEvent(event);
    return event;
  };
  return { canvas, document, focusCalls, dispatch, cleanup };
}

test('wheel and trackpad map zoom release Space from a previously focused control', () => {
  for (const ctrlKey of [false, true]) {
    const { canvas, document, focusCalls, dispatch } = setup();
    assert.equal(slideshowShortcut({ key: ' ', target: document.activeElement }), undefined);
    assert.equal(dispatch('wheel', { deltaY: -30, ctrlKey }).defaultPrevented, false);
    assert.equal(document.activeElement, canvas);
    assert.deepEqual(focusCalls, [{ preventScroll: true }]);
    assert.equal(slideshowShortcut({ key: ' ', target: document.activeElement }), 'hideMaps');
  }
});

test('wheel zoom preserves typing focus and pointer focus is left to the browser', () => {
  const input = targetMatching('textarea');
  const { document, dispatch, focusCalls } = setup(input);
  dispatch('wheel', { deltaY: 50 });
  assert.equal(document.activeElement, input);
  assert.equal(dispatch('pointerdown').defaultPrevented, false);
  assert.deepEqual(focusCalls, []);
});

test('wheel zoom leaves focus alone when Space can already compare maps', () => {
  for (const selector of ['body', '.slideshow-scroll', '.maplibregl-canvas', 'a[href]']) {
    const target = targetMatching(selector);
    const { document, dispatch, focusCalls } = setup(target);
    dispatch('wheel', { deltaY: 50 });
    assert.equal(document.activeElement, target);
    assert.deepEqual(focusCalls, []);
  }
});

test('cleanup and non-zoom wheel events leave focus alone', () => {
  const { dispatch, cleanup, focusCalls } = setup();
  dispatch('wheel', { deltaY: 0 });
  dispatch('wheel', { deltaY: 50, metaKey: true });
  dispatch('wheel', { deltaY: 50, altKey: true });
  cleanup();
  dispatch('wheel', { deltaY: 50 });
  dispatch('pointerdown');
  assert.deepEqual(focusCalls, []);
});
