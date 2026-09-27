import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigatorSwipe } from '../src/lib/shared/navigator-swipe.ts';

function setup(matches = true) {
  const element = new EventTarget();
  const media = { matches };
  const captured = new Set();
  element.ownerDocument = { defaultView: { matchMedia: () => media } };
  element.setPointerCapture = (id) => captured.add(id);
  element.hasPointerCapture = (id) => captured.has(id);
  element.releasePointerCapture = (id) => captured.delete(id);
  const navigations = [];
  const action = navigatorSwipe(element, (direction) => navigations.push(direction));
  const dispatch = (type, props = {}) => {
    const { target, ...attributes } = props;
    const event = Object.assign(new Event(type, { cancelable: true }), {
      pointerId: 1, pointerType: 'touch', isPrimary: true,
      clientX: 150, clientY: 600, detail: 1, ...attributes,
    });
    if (target) Object.defineProperty(event, 'target', { value: target });
    element.dispatchEvent(event);
    return event;
  };
  const swipe = (from, to, props = {}) => {
    dispatch('pointerdown', { clientX: from, ...props });
    dispatch('pointermove', { clientX: to, ...props });
    dispatch('pointerup', { clientX: to, ...props });
  };
  return { action, dispatch, swipe, navigations, captured, media };
}

test('left and right swipes navigate once on release and consume the following click', () => {
  const { dispatch, swipe, navigations, captured } = setup();
  swipe(220, 100);
  assert.deepEqual(navigations, ['next']);
  assert.equal(captured.size, 0);
  assert.equal(dispatch('click').defaultPrevented, true);
  swipe(100, 220);
  assert.deepEqual(navigations, ['next', 'previous']);
});

test('a tap after a swipe and keyboard activation still work normally', () => {
  const { dispatch, swipe, navigations } = setup();
  swipe(220, 100);
  assert.equal(dispatch('click', { detail: 0 }).defaultPrevented, false);
  dispatch('pointerdown');
  dispatch('pointerup');
  assert.equal(dispatch('click').defaultPrevented, false);
  assert.deepEqual(navigations, ['next']);
});

test('small finger jitter remains a tap; short drags do not activate a button', () => {
  const { dispatch, swipe, navigations } = setup();
  swipe(150, 145);
  assert.equal(dispatch('click').defaultPrevented, false);
  swipe(150, 125);
  assert.equal(dispatch('click').defaultPrevented, true);
  assert.deepEqual(navigations, []);
});

test('vertical and diagonal gestures do not navigate or capture scrolling', () => {
  const { dispatch, navigations, captured } = setup();
  dispatch('pointerdown');
  assert.equal(dispatch('pointermove', { clientX: 120, clientY: 650 }).defaultPrevented, false);
  dispatch('pointerup', { clientX: 80, clientY: 680 });
  assert.deepEqual(navigations, []);
  assert.equal(captured.size, 0);
});

test('cancelled, interrupted and secondary touch gestures never navigate', () => {
  for (const interruption of ['pointercancel', 'lostpointercapture']) {
    const { dispatch, navigations } = setup();
    dispatch('pointerdown');
    dispatch('pointermove', { clientX: 80 });
    dispatch(interruption, { clientX: 80 });
    dispatch('pointerup', { clientX: 80 });
    assert.deepEqual(navigations, []);
  }
  const { swipe, navigations } = setup();
  swipe(220, 100, { isPrimary: false });
  assert.deepEqual(navigations, []);
});

test('transferring touch capture from a nested button keeps the swipe active', () => {
  const { dispatch, navigations } = setup();
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 80 });
  dispatch('lostpointercapture', { target: new EventTarget() });
  dispatch('pointerup', { clientX: 80 });
  assert.deepEqual(navigations, ['next']);
});

test('desktop, mouse gestures and resizing out of mobile mode do not navigate', () => {
  const desktop = setup(false);
  desktop.swipe(220, 100);
  assert.deepEqual(desktop.navigations, []);
  const { dispatch, swipe, navigations, media } = setup();
  swipe(220, 100, { pointerType: 'mouse' });
  dispatch('pointerdown');
  dispatch('pointermove', { clientX: 80 });
  media.matches = false;
  dispatch('pointerup', { clientX: 80 });
  assert.deepEqual(navigations, []);
});

test('updated callbacks use the current chapter and destroy removes gesture handling', () => {
  const { action, swipe, navigations } = setup();
  const updated = [];
  action.update((direction) => updated.push(direction));
  swipe(220, 100);
  assert.deepEqual(updated, ['next']);
  assert.deepEqual(navigations, []);
  action.destroy();
  swipe(100, 220);
  assert.deepEqual(updated, ['next']);
});
