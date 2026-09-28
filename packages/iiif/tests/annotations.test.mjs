import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAnnotationImages } from '../src/annotations.ts';

test('resolve local annotation images without mutating the source, provenance or georeferencing', () => {
  const local = 'assets/images/map.jpg';
  const source = { type: 'ImageService2', id: local, width: 20, height: 10,
    partOf: [{ id: local, type: 'ImageService2' }], provider: [{ id: local, type: 'ImageService3' }] };
  const document = { type: 'AnnotationPage', items: [
    { type: 'Annotation', body: { gcps: [{ resource: [0, 0], geo: [4, 52] }] },
      target: { source, selector: { type: 'SvgSelector', value: '<svg>mask</svg>' } } },
    { type: 'Annotation', target: { source: { type: 'ImageService2', id: 'https://external.example.org/image' } } },
  ] };
  const original = structuredClone(document);
  const resolved = resolveAnnotationImages(document, image => image === local ? 'https://example.org/story/iiif/map' : undefined);
  assert.equal(resolved.items[0].target.source.id, 'https://example.org/story/iiif/map');
  assert.equal(resolved.items[0].target.source.type, 'ImageService3');
  assert.deepEqual(resolved.items[0].target.source.partOf, source.partOf);
  assert.deepEqual(resolved.items[0].target.source.provider, source.provider);
  assert.deepEqual(resolved.items[0].body, document.items[0].body);
  assert.deepEqual(resolved.items[0].target.selector, document.items[0].target.selector);
  assert.deepEqual(resolved.items[1], document.items[1]);
  assert.deepEqual(document, original);
});

test('ordinary JSON/GeoJSON data is preserved', () => {
  const geojson = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'assets/images/map.jpg' },
    geometry: { type: 'Point', coordinates: [4, 52] } }] };
  assert.deepEqual(resolveAnnotationImages(geojson, () => { throw new Error('not an image service'); }), geojson);
});
