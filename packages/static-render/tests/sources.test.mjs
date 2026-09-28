import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { Sources } from '../src/sources.ts';

test('relative annotation images render from disk with a base path and no running server', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-local-sources-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'custom-images'));
  await sharp({ create: { width: 24, height: 16, channels: 3, background: 'red' } })
    .png().toFile(path.join(root, 'custom-images/map.png'));
  const document = { type: 'AnnotationPage', items: [{ type: 'Annotation', target: {
    source: { type: 'ImageService2', id: './custom-images/map.png', width: 24, height: 16 },
  } }] };
  const annotationFile = path.join(root, 'map.json');
  await writeFile(annotationFile, JSON.stringify(document));
  const sources = new Sources({ get: () => { throw new Error('No remote downloads expected'); } }, {
    images: { '/story/iiif/map': 'custom-images/map.png' },
    data: { '/story/api/annotations/map.json': 'map.json' },
  }, root);
  const annotation = JSON.parse((await sources.get('/story/api/annotations/map.json')).bytes);
  const service = annotation.items[0].target.source;
  assert.equal(service.id, 'http://slides.local/story/iiif/map');
  assert.equal(service.type, 'ImageService3');
  const info = JSON.parse((await sources.get(`${service.id}/info.json`)).bytes);
  assert.deepEqual([info.width, info.height], [24, 16]);
  const image = await sources.get(`${service.id}/full/max/0/default.jpg`);
  const metadata = await sharp(image.bytes).metadata();
  assert.deepEqual([metadata.width, metadata.height], [24, 16]);
  assert.deepEqual(JSON.parse(await readFile(annotationFile, 'utf8')), document);
});
