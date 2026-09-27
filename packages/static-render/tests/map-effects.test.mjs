import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMapEffects } from '../src/map-effects.ts';
import { staticMapOptions } from '../src/map-options.ts';

test('background removal, additive colorization and opacity preserve transparent pixels', async () => {
  const pixels = Uint8Array.from([
    255, 255, 255, 255, // paper
    0, 0, 0, 255, // ink
    0, 0, 0, 128, // translucent ink
    0, 0, 0, 0, // outside the mask
  ]);
  await applyMapEffects(pixels, {
    removeColor: true, removeColorColor: '#fff', colorize: true,
    colorizeColor: '#306090', opacity: 0.5,
  }, 'map');
  assert.equal(pixels[3], 0);
  assert.deepEqual([...pixels.slice(4, 8)], [48, 96, 144, 128]);
  assert.deepEqual([...pixels.slice(8, 12)], [48, 96, 144, 64]);
  assert.equal(pixels[15], 0);
});

test('removal has a smooth threshold, a hard cutoff and an off switch', async () => {
  const sample = () => Uint8Array.from([0, 0, 0, 255, 128, 0, 0, 255, 255, 0, 0, 255]);
  const effects = { removeColor: true, removeColorColor: '#000', removeColorThreshold: 1, removeColorHardness: 0 };
  const smooth = sample();
  await applyMapEffects(smooth, effects, 'map');
  assert.equal(smooth[3], 0);
  assert.ok(smooth[7] >= 127 && smooth[7] <= 129);
  assert.equal(smooth[11], 255);
  const hard = sample();
  await applyMapEffects(hard, { ...effects, removeColorHardness: 1 }, 'map');
  assert.deepEqual([hard[3], hard[7], hard[11]], [0, 0, 255]);
  const disabled = sample();
  await applyMapEffects(disabled, { ...effects, removeColorThreshold: 0 }, 'map');
  assert.deepEqual(disabled, sample());
});

test('saturation precedes colorization and uses Allmaps luminance, including default effect colors', async () => {
  const pixels = Uint8Array.from([255, 0, 0, 255]);
  await applyMapEffects(pixels, { saturation: 0, colorize: true, colorizeColor: '#003366' }, 'map');
  assert.deepEqual([...pixels], [54, 105, 156, 255]);
  const defaults = Uint8Array.from([34, 34, 34, 255, 0, 0, 0, 255]);
  await applyMapEffects(defaults, { removeColor: true }, 'map');
  assert.equal(defaults[3], 0, 'Allmaps removes #222222 by default');
  const ink = Uint8Array.from([0, 0, 0, 255]);
  await applyMapEffects(ink, { colorize: true }, 'map');
  assert.deepEqual([...ink], [255, 86, 186, 255]);
});

test('unsupported map options warn together and leave supported settings usable', t => {
  const messages = [];
  t.mock.method(console, 'warn', message => messages.push(message));
  const result = staticMapOptions({
    opacity: 0.6, applyMask: false, colorize: true, colorizeColor: '#123456',
    distortionMeasure: 'log2sigma', renderAppliedMask: true,
    renderGrid: true, debugTiles: true, debugTriangles: true,
    renderGcps: false, futureEffect: true, anticipateVisibility: true,
  }, 'example-map');
  assert.deepEqual(result.options, { applyMask: false });
  assert.deepEqual(result.effects, { opacity: 0.6, colorize: true, colorizeColor: '#123456' });
  assert.equal(messages.length, 1);
  for (const option of ['example-map', 'distortionMeasure', 'renderAppliedMask', 'renderGrid', 'debugTiles', 'debugTriangles', 'futureEffect'])
    assert.ok(messages[0].includes(option));
  assert.ok(!messages[0].includes('renderGcps'));
  assert.ok(!messages[0].includes('anticipateVisibility'));
});

test('invalid effect colors warn and leave the other effects active', async t => {
  const messages = [];
  t.mock.method(console, 'warn', message => messages.push(message));
  const pixels = Uint8Array.from([0, 0, 0, 255]);
  await applyMapEffects(pixels, { colorize: true, colorizeColor: 'invalid', opacity: 0.5 }, 'example-map');
  assert.deepEqual([...pixels], [0, 0, 0, 128]);
  assert.match(messages[0], /example-map.*colorizeColor/);
});
