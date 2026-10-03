import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { generateAnnotation } from '@allmaps/annotation';
import { loadSlidesConfig } from '../src/content/config.ts';
import { loadContent } from '../src/content/index.ts';
import { prepareThumbnails } from '../src/build/prepare.ts';

test('authored inner margins override slide and sharing preview defaults without changing layer cards', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-padding-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'chapters'));
  await mkdir(path.join(root, 'assets/images'), { recursive: true });
  await mkdir(path.join(root, 'assets/annotations'));
  await sharp({ create: { width: 64, height: 64, channels: 3, background: '#123456' } })
    .png().toFile(path.join(root, 'assets/images/map.png'));
  await writeFile(path.join(root, 'assets/annotations/map.json'), JSON.stringify(generateAnnotation({
    '@context': 'https://schemas.allmaps.org/map/2/context.json', type: 'GeoreferencedMap',
    resource: { id: 'https://example.org/iiif/map', type: 'ImageService3', width: 64, height: 64 },
    resourceMask: [[0, 0], [64, 0], [64, 64], [0, 64]],
    gcps: [
      { resource: [0, 0], geo: [4.91, 52.38] }, { resource: [64, 0], geo: [4.92, 52.38] },
      { resource: [64, 64], geo: [4.92, 52.374] }, { resource: [0, 64], geo: [4.91, 52.374] },
    ], transformation: { type: 'polynomial', options: { order: 1 } },
  })));
  await writeFile(path.join(root, 'slides.config.json'), JSON.stringify({
    title: 'Padding', slideshows: [{ id: 'main', path: 'chapters' }],
  }));
  const cameras = [];
  for (const padding of [undefined, 0, 40, -20]) {
    const metadata = { title: 'Map', fit: 'cover', padding, warpedMaps: [{ path: 'assets/annotations/map.json' }] };
    await writeFile(path.join(root, 'chapters/01-map.md'), `---\n${JSON.stringify(metadata)}\n---\nMap`);
    const content = await loadContent(await loadSlidesConfig({ content: root }));
    const { plan, manifest } = await prepareThumbnails(content, {
      assetRoot: root, cacheRoot: path.join(root, 'cache'), annotationsRoot: path.join(root, 'annotations'), offline: true, refresh: false,
    });
    const camera = image => plan.jobs.find(job => job.id === image.path).camera;
    cameras.push({ light: camera(manifest.slides['main:map'].light), dark: camera(manifest.slides['main:map'].dark),
      social: camera(manifest.social.main), layer: camera(Object.values(manifest.layers)[0]) });
  }
  const [defaults, zero, inset, cropped] = cameras;
  for (const type of ['light', 'dark', 'social']) {
    assert.ok(zero[type].zoom > defaults[type].zoom, `${type}: padding 0 must remove the default margin`);
    assert.ok(inset[type].zoom < defaults[type].zoom, `${type}: padding 40 must increase the margin`);
    assert.ok(cropped[type].zoom > zero[type].zoom, `${type}: padding -20 must zoom beyond the visible edges`);
    assert.deepEqual(zero[type].center, defaults[type].center);
    assert.deepEqual(inset[type].center, defaults[type].center);
    assert.deepEqual(cropped[type].center, defaults[type].center);
  }
  assert.deepEqual(zero.layer, defaults.layer);
  assert.deepEqual(inset.layer, defaults.layer);
  assert.deepEqual(cropped.layer, defaults.layer);
});
