import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLayerTransitions } from '../src/lib/shared/map/layer-transitions.ts';
import { getGeoJsonLayers } from '@allmaps/slides/model/geojson';

function setup(layer, visible = false) {
  const listeners = new Set();
  const writes = [];
  const paint = { ...layer.paint };
  const layout = { ...layer.layout };
  let exists = true;
  const map = {
    getLayer: () => exists,
    setLayoutProperty: (_, key, value) => { writes.push(['layout', key, value]); layout[key] = value; },
    setPaintProperty: (_, key, value) => { writes.push(['paint', key, value]); paint[key] = value; },
    on: (_, callback) => listeners.add(callback),
    off: (_, callback) => listeners.delete(callback),
  };
  const transitions = createLayerTransitions(map);
  transitions.set(layer, visible);
  return { transitions, paint, layout, writes, listeners,
    render: () => { for (const callback of [...listeners]) callback(); },
    remove: () => { exists = false; },
  };
}

const line = getGeoJsonLayers('route')[1];
const circle = getGeoJsonLayers('places')[2];
const labels = { id: 'labels', type: 'symbol', source: 'places', paint: { 'text-opacity': 0.8 } };

test('native whole-layer opacity fades preserve feature styling and hide only after the rendered transition', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { transitions, paint, layout, render, writes, listeners } = setup(line);
  assert.equal(layout.visibility, 'none');
  assert.equal(paint['line-layer-opacity'], 0);
  assert.equal(listeners.size, 0);
  transitions.set(line, true);
  assert.equal(layout.visibility, 'visible');
  assert.equal(paint['line-layer-opacity'], undefined, 'restore authored/default opacity');
  assert.deepEqual(paint['line-layer-opacity-transition'], { duration: 300, delay: 0 });
  assert.deepEqual(paint['line-opacity'], line.paint['line-opacity']);

  transitions.set(line, false);
  assert.equal(paint['line-layer-opacity'], 0);
  t.mock.timers.tick(1000);
  assert.equal(layout.visibility, 'visible', 'wait for MapLibre to render the paint update');
  render();
  const count = writes.length;
  t.mock.timers.tick(299);
  assert.equal(writes.length, count, 'no per-frame paint writes');
  assert.equal(layout.visibility, 'visible');
  t.mock.timers.tick(1);
  assert.equal(layout.visibility, 'none');
  assert.deepEqual(paint['line-opacity'], line.paint['line-opacity']);
});

test('circle and symbol opacity is passed to MapLibre unchanged, including feature expressions', () => {
  for (const [layer, properties] of [[circle, ['circle-opacity', 'circle-stroke-opacity']], [labels, ['text-opacity', 'icon-opacity']]]) {
    const original = structuredClone(layer);
    const { transitions, paint, layout } = setup(layer);
    for (const property of properties) assert.equal(paint[property], 0);
    transitions.set(layer, true);
    for (const property of properties) {
      assert.deepEqual(paint[property], layer.paint?.[property]);
      assert.deepEqual(paint[`${property}-transition`], { duration: 300, delay: 0 });
    }
    assert.equal(layout.visibility, 'visible');
    assert.deepEqual(layer, original);
  }
});

test('rapid reversals cancel pending hiding before and after the paint update renders', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const rendered of [false, true]) {
    const { transitions, paint, layout, render, listeners } = setup(labels, true);
    transitions.set(labels, false);
    if (rendered) { render(); t.mock.timers.tick(150); }
    transitions.set(labels, true);
    assert.equal(paint['text-opacity'], 0.8);
    assert.equal(listeners.size, 0);
    render();
    t.mock.timers.tick(1000);
    assert.equal(layout.visibility, 'visible');
  }
});

test('visibility waits for the longest native duration and delay, and omitted overrides restore defaults', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { transitions, paint, layout, render } = setup(labels, true);
  const updated = { ...labels, paint: { 'text-opacity': 0.4, 'text-opacity-transition': { duration: 700, delay: 40 } } };
  transitions.set(updated, false);
  assert.deepEqual(paint['text-opacity-transition'], { duration: 700, delay: 40 });
  render();
  t.mock.timers.tick(739);
  assert.equal(layout.visibility, 'visible');
  t.mock.timers.tick(1);
  assert.equal(layout.visibility, 'none');
  transitions.set(labels, true);
  assert.equal(paint['text-opacity'], 0.8);
  assert.deepEqual(paint['text-opacity-transition'], { duration: 300, delay: 0 });
});

test('initial rendering and immediate updates bypass transitions and pending hiding', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { transitions, paint, layout, render, listeners } = setup(labels, true);
  assert.deepEqual(paint['text-opacity-transition'], { duration: 0, delay: 0 });
  transitions.set(labels, false);
  render();
  transitions.set(labels, false, true);
  assert.equal(layout.visibility, 'none');
  assert.equal(listeners.size, 0);
  transitions.set(labels, true, true);
  assert.equal(layout.visibility, 'visible');
  assert.equal(paint['text-opacity'], 0.8);
  assert.deepEqual(paint['text-opacity-transition'], { duration: 0, delay: 0 });
  t.mock.timers.tick(1000);
  assert.equal(layout.visibility, 'visible');
});

test('destroy cancels deferred hiding and removed layers are not updated', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const operation of ['destroy-before-render', 'destroy-after-render', 'remove']) {
    const { transitions, writes, listeners, render, remove } = setup(labels, true);
    transitions.set(labels, false);
    if (operation !== 'destroy-before-render') render();
    if (operation === 'remove') remove(); else transitions.destroy();
    const count = writes.length;
    render();
    t.mock.timers.tick(1000);
    assert.equal(writes.length, count);
    assert.equal(listeners.size, 0);
  }
});
