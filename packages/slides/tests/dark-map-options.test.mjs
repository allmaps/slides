import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { generateAnnotation } from '@allmaps/annotation';
import { renderBatch } from '@allmaps/static-render';
import { slideMetadataSchema } from '../src/model/content-schema.ts';
import { getWarpedMapOptions, layerPreviewKey } from '../src/model/map/annotations.ts';
import { loadSlidesConfig } from '../src/content/config.ts';
import { loadContent } from '../src/content/index.ts';
import { prepareThumbnails } from '../src/build/prepare.ts';

test('dark map overrides validate and merge without mutating the light settings', () => {
  const metadata = { title: 'Map', warpedMaps: [{ url: '/map.json', options: { colorize: true, colorizeColor: '#000000' }, darkOptions: { colorizeColor: '#ffffff', opacity: 0.6 } }] };
  const map = slideMetadataSchema.parse(metadata).warpedMaps[0];
  const dark = getWarpedMapOptions(map, 'dark');
  assert.equal(dark.colorizeColor, '#ffffff');
  assert.equal(dark.colorize, true);
  assert.equal(dark.applyMask, true);
  assert.equal(dark.opacity, 0.6);
  assert.equal(getWarpedMapOptions(map, 'light').colorizeColor, '#000000');
  assert.equal(getWarpedMapOptions(map, 'light').opacity, 1);
  assert.notEqual(layerPreviewKey(map, 'dark'), layerPreviewKey(map, 'light'));
  assert.equal(layerPreviewKey({ url: 'map' }, 'dark'), layerPreviewKey({ url: 'map' }, 'light'));
  for (const darkOptions of [null, [], 'white'])
    assert.equal(slideMetadataSchema.safeParse({ ...metadata, warpedMaps: [{ url: 'map', darkOptions }] }).success, false);
});

test('preview plans use theme-specific map effects and extents, including layer thumbnails and light social images', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-dark-maps-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'chapters'));
  await mkdir(path.join(root, 'assets/images'), { recursive: true });
  await mkdir(path.join(root, 'assets/annotations'));
  await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000000' } })
    .png().toFile(path.join(root, 'assets/images/map.png'));
  const annotation = generateAnnotation({
    '@context': 'https://schemas.allmaps.org/map/2/context.json', type: 'GeoreferencedMap',
    resource: { id: 'https://example.org/iiif/map', type: 'ImageService3', width: 64, height: 64 },
    resourceMask: [[16, 16], [48, 16], [48, 48], [16, 48]],
    gcps: [
      { resource: [0, 0], geo: [4.91, 52.38] }, { resource: [64, 0], geo: [4.92, 52.38] },
      { resource: [64, 64], geo: [4.92, 52.374] }, { resource: [0, 64], geo: [4.91, 52.374] },
    ], transformation: { type: 'projective' },
  });
  await writeFile(path.join(root, 'assets/annotations/map.json'), JSON.stringify(annotation));
  const style = { version: 8, sources: {}, layers: [] };
  await writeFile(path.join(root, 'slides.config.json'), JSON.stringify({
    title: 'Dark maps', slideshows: [{ id: 'main', path: 'chapters' }], map: { styles: { light: style, dark: style } },
  }));
  const metadata = { title: 'First', warpedMaps: [{ url: '/api/annotations/map.json',
    options: { colorize: true, colorizeColor: '#000000' },
    darkOptions: { colorizeColor: '#ffffff', applyMask: false },
  }] };
  await writeFile(path.join(root, 'chapters/01-first.md'), `---\n${JSON.stringify(metadata)}\n---\nMap`);
  const content = await loadContent(await loadSlidesConfig({ content: root }));
  const { plan, manifest } = await prepareThumbnails(content, {
    assetRoot: root, cacheRoot: path.join(root, 'cache'), annotationsRoot: path.join(root, 'annotations'), offline: true, refresh: false,
  });
  const job = image => plan.jobs.find(job => job.id === image.path);
  const light = job(manifest.slides['main:first'].light), dark = job(manifest.slides['main:first'].dark);
  assert.equal(plan.layers[light.layers[0]].effects.colorizeColor, '#000000');
  assert.equal(plan.layers[dark.layers[0]].effects.colorizeColor, '#ffffff');
  assert.ok(dark.camera.zoom < light.camera.zoom - 0.9, 'dark preview must fit the full unmasked image');
  assert.equal(job(manifest.social.main).layers[0], light.layers[0]);
  const props = content.project.slideshows[0].chapters[0].warpedMaps[0];
  const layerJobs = ['light', 'dark'].map(theme => job(manifest.layers[layerPreviewKey(props, theme)]));
  assert.notEqual(layerJobs[0].layers[0], layerJobs[1].layers[0]);
  // Render the transparent layer previews to verify the actual pixel pipeline offline.
  plan.jobs = layerJobs;
  const outputRoot = path.join(root, 'out');
  const result = await renderBatch(plan, { assetRoot: root, cacheRoot: path.join(root, 'render-cache'), outputRoot, offline: true });
  for (const [index, preview] of layerJobs.entries()) {
    const { data, info } = await sharp(path.join(outputRoot, result.images[preview.id].path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const center = (128 * info.width + 128) * 4;
    assert.ok(index === 0 ? data[center] < 10 : data[center] > 245);
    assert.equal(data[center + 3], 255);
  }
});
