import assert from 'node:assert/strict';
import { test } from 'node:test';
import { panelScroll } from '../src/lib/shared/panel-scroll.ts';
import { slideshowShortcut } from '../src/lib/shared/keyboard.ts';

function targetMatching(...matches) {
  return { closest(selectors) {
    return selectors.split(',').some(selector => matches.includes(selector.trim())) ? this : null;
  } };
}

function setup(focused = targetMatching('button')) {
  const element = Object.assign(new EventTarget(), targetMatching());
  const document = { activeElement: focused };
  const focusCalls = [];
  element.ownerDocument = document;
  element.focus = (options) => { focusCalls.push(options); document.activeElement = element; };
  const interruptions = [];
  const action = panelScroll(element, () => interruptions.push('interrupt'));
  const dispatch = (type, props = {}) => {
    const { target, prevented, ...attributes } = props;
    const event = Object.assign(new Event(type, { cancelable: true }), attributes);
    if (target) Object.defineProperty(event, 'target', { value: target });
    if (prevented) event.preventDefault();
    element.dispatchEvent(event);
    return event;
  };
  return { element, document, focusCalls, interruptions, action, dispatch };
}

test('scrolling text after clicking a button returns Space to map comparison without jumping the panel', () => {
  const { document, element, dispatch, focusCalls, interruptions } = setup();
  assert.equal(slideshowShortcut({ key: ' ', target: document.activeElement }), undefined);
  assert.equal(dispatch('wheel', { deltaY: 50 }).defaultPrevented, false);
  assert.equal(document.activeElement, element);
  assert.deepEqual(focusCalls, [{ preventScroll: true }]);
  assert.equal(slideshowShortcut({ key: ' ', target: document.activeElement }), 'hideMaps');
  assert.equal(interruptions.length, 1);
});

test('Space consumed later by the slideshow does not interrupt an in-progress chapter scroll', async () => {
  const { dispatch, interruptions } = setup();
  const event = dispatch('keydown', { key: ' ' });
  assert.equal(slideshowShortcut({ key: event.key, target: event.target }), 'hideMaps');
  // Native dispatch can run microtasks between the panel and window listeners.
  await Promise.resolve();
  assert.equal(interruptions.length, 0);
  // The slideshow handles the key after it bubbles through the reading panel.
  event.preventDefault();
  dispatch('keydown', { key: ' ', repeat: true });
  assert.equal(interruptions.length, 0);

  dispatch('keydown', { key: 'PageDown' });
  assert.equal(interruptions.length, 1);
});

test('native scrolling keys still interrupt navigation, including Shift+Space', () => {
  const { dispatch, interruptions } = setup();
  for (const key of ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']) {
    const event = dispatch('keydown', { key, shiftKey: key === ' ' });
    assert.equal(event.defaultPrevented, false, key);
  }
  assert.equal(interruptions.length, 7);
});

test('focused controls keep their keyboard behavior and text entry keeps focus while scrolling', () => {
  const { dispatch, interruptions, focusCalls } = setup();
  for (const [key, selector] of [[' ', 'button'], [' ', 'summary'], ['PageDown', 'textarea'], ['ArrowDown', '[role="slider"]']]) {
    assert.equal(dispatch('keydown', { key, target: targetMatching(selector) }).defaultPrevented, false);
  }
  assert.equal(interruptions.length, 0);
  assert.equal(focusCalls.length, 0);

  const input = targetMatching('textarea');
  const typing = setup(input);
  typing.dispatch('wheel', { deltaY: 50 });
  assert.equal(typing.document.activeElement, input);
  assert.equal(typing.focusCalls.length, 0);
  const before = typing.interruptions.length;
  typing.dispatch('wheel', { deltaY: 50, target: input });
  assert.equal(typing.interruptions.length, before);
});

test('zoom gestures, consumed events and browser shortcuts do not take reading focus or interrupt', () => {
  const { dispatch, focusCalls, interruptions } = setup();
  for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
    dispatch('wheel', { deltaY: 50, [modifier]: true });
    dispatch('keydown', { key: 'Home', [modifier]: true });
  }
  dispatch('wheel', { deltaY: 0 });
  dispatch('keydown', { key: 'PageDown', prevented: true });
  dispatch('wheel', { deltaY: 50, prevented: true });
  assert.equal(interruptions.length, 0);
  assert.equal(focusCalls.length, 0);
});

test('cleanup removes gesture handlers', () => {
  const { dispatch, action, interruptions, focusCalls } = setup();
  action.destroy();
  dispatch('keydown', { key: 'PageDown' });
  dispatch('wheel', { deltaY: 50 });
  dispatch('pointerdown');
  assert.equal(interruptions.length, 0);
  assert.equal(focusCalls.length, 0);
});
