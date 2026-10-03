import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseConfigDocument } from '../src/model/config.ts';
import { parseSlidesConfig, slidesConfigSchema, slideMetadataSchema } from '../src/model/content-schema.ts';
import { buildProject } from '../src/model/project.ts';
import { resolveUserLayers, applyUserLayerChanges, getUserLayerGlyphs } from '../src/model/map/layers.ts';
import { resolveBasemapStyle, getEffectiveBasemapStyleConfig } from '../src/model/basemap.ts';

const sources = { places: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } };
const labels = {
  id: 'place-labels', type: 'symbol', source: 'places',
  layout: { visibility: 'none', 'text-field': ['get', 'Naam'], 'text-font': ['Noto Sans Regular'] },
  paint: { 'text-color': '#34373d' },
};

test('YAML preserves global defaults and custom label expressions through project generation', () => {
  const raw = parseConfigDocument(`
title: Places
sources:
  places:
    type: geojson
    path: assets/places.geojson
layers:
  - layer: places-point-circle
    visibility: none
  - id: place-labels
    type: symbol
    source: places
    layout:
      visibility: none
      text-field: [get, Naam]
      text-font: [Noto Sans Regular]
    paint:
      text-color: '#34373d'
slideshows:
  - id: main
    path: chapters
    start:
      layers:
        - layer: place-labels
          visibility: visible
`, 'slides.config.yml');
  const parsed = parseSlidesConfig(raw, 'fixture');
  assert.equal(parsed.success, true);
  const project = buildProject(parsed.data, {
    'chapters/01-place.md': { metadata: { title: 'Places', layers: [{ layer: 'place-labels', visibility: 'visible' }] } },
  }, path => `/content/${path}`);
  const show = project.slideshows[0];
  assert.equal(show.sources.places.data, '/content/assets/places.geojson');
  assert.deepEqual(show.layers.map(layer => layer.id), [
    'user-places-fill', 'user-places-line', 'user-places-point-circle', 'user-places-point-symbol', 'user-place-labels',
  ]);
  assert.equal(show.layers.find(layer => layer.type === 'circle').layout.visibility, 'none');
  assert.deepEqual(show.layers.at(-1).layout['text-field'], ['get', 'Naam']);
  assert.equal(applyUserLayerChanges(show.layers, show.start.layers).at(-1).layout.visibility, 'visible');
  assert.equal(applyUserLayerChanges(show.layers, show.chapters[0].layers).at(-1).layout.visibility, 'visible');
});

test('slide overrides reset to global defaults and feature expressions in any navigation order', () => {
  const defaults = resolveUserLayers(sources, [
    { layer: 'places-line', visibility: 'none', duration: 700 },
    { layer: 'places-point-circle', opacity: 0.4 }, labels,
  ]);
  const original = structuredClone(defaults);
  const changes = [
    { layer: 'places-line', visibility: 'visible', opacity: 0, duration: 0 },
    { layer: 'places-point-circle', opacity: 0.9 },
    { layer: 'place-labels', visibility: 'visible', opacity: 0.6 },
  ];
  for (const overrides of [changes, undefined, changes, [], changes, undefined]) {
    const current = applyUserLayerChanges(defaults, overrides);
    const line = current.find(layer => layer.type === 'line');
    const circle = current.find(layer => layer.type === 'circle');
    const symbol = current.at(-1);
    if (overrides === changes) {
      assert.equal(line.layout.visibility, 'visible');
      assert.equal(line.paint['line-opacity'], 0);
      assert.deepEqual(line.paint['line-opacity-transition'], { duration: 0 });
      assert.equal(circle.paint['circle-opacity'], 0.9);
      assert.equal(circle.paint['circle-stroke-opacity'], 0.9);
      assert.equal(symbol.paint['text-opacity'], 0.6);
      assert.equal(symbol.paint['icon-opacity'], 0.6);
    } else {
      assert.equal(line.layout.visibility, 'none');
      assert.ok(Array.isArray(line.paint['line-opacity']));
      assert.deepEqual(line.paint['line-opacity-transition'], { duration: 700 });
      assert.equal(circle.paint['circle-opacity'], 0.4);
      assert.equal(symbol.layout.visibility, 'none');
      assert.equal(symbol.paint['text-opacity'], undefined);
    }
  }
  assert.deepEqual(defaults, original, 'resolving a slide must not mutate shared defaults');
});

test('a custom definition replaces a generated layer and follows authored drawing order', () => {
  const custom = { id: 'places-point-circle', type: 'circle', source: 'places', paint: { 'circle-radius': 3 } };
  const layers = resolveUserLayers(sources, [custom, labels]);
  assert.equal(layers.filter(layer => layer.id === 'user-places-point-circle').length, 1);
  assert.deepEqual(layers.at(-2).paint, { 'circle-radius': 3 });
  assert.equal(layers.at(-1).id, 'user-place-labels');
});

test('invalid layer configuration and references fail before loading a map', () => {
  for (const layers of [
    [{ id: 'bad', type: 'symbol' }],
    [{ id: 'bad', source: 'places', type: 'typo' }],
    [{ layer: 'places-line', opacity: 2 }],
    [{ layer: 'places-line', duration: -1 }],
    [{ id: 'bad', source: 'places', type: 'symbol', layout: { visibility: 'hidden' } }],
  ]) assert.equal(slidesConfigSchema.safeParse({ layers }).success, false);
  assert.equal(slideMetadataSchema.safeParse({ title: 'Bad', layers: [{ layer: 'x', opacity: -1 }] }).success, false);
  assert.throws(() => resolveUserLayers(sources, [{ layer: 'user-places-line', visibility: 'none' }]), /Unknown layer/);
  assert.throws(() => resolveUserLayers(sources, [{ ...labels, source: 'missing' }]), /Unknown source/);
  assert.throws(() => resolveUserLayers(sources, [labels, labels]), /Duplicate layer id/);
  assert.throws(() => resolveUserLayers(sources, [{ layer: 'places-line' }, { layer: 'places-line' }]), /Duplicate layer/);
  const config = { title: 'Places', main: 'main', sources: {}, slideshows: [{ id: 'main', path: 'chapters' }] };
  assert.throws(() => buildProject(config, { 'chapters/01-places.md': { metadata: {
    title: 'Places', layers: [{ layer: 'missing', visibility: 'visible' }],
  } } }), /Unknown layer missing in chapters\/01-places.md/);
});

test('text layers have glyphs without a basemap, while non-text overlays need none', async () => {
  assert.equal(getUserLayerGlyphs(resolveUserLayers(sources)), undefined);
  assert.match(getUserLayerGlyphs(resolveUserLayers(sources, [labels])), /\{fontstack\}\/\{range\}\.pbf$/);
  const config = getEffectiveBasemapStyleConfig({ theme: 'light', appMap: {
    protomaps: { glyphs: 'https://example.org/fonts/{fontstack}/{range}.pbf' },
  } });
  const style = await resolveBasemapStyle({ theme: 'light', config });
  assert.equal(style.glyphs, 'https://example.org/fonts/{fontstack}/{range}.pbf');
  assert.deepEqual(style.sources, {});
});
