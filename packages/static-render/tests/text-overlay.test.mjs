import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { renderBatch, validateRenderPlan } from '../src/index.ts';

test('text overlays use supplied fonts, escape markup, fit long copy and leave clean previews unchanged', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'render-text-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const options = { assetRoot: root, cacheRoot: path.join(root, 'cache'), outputRoot: path.join(root, 'out'), offline: true };
  const font = await readFile(new URL('./fixtures/fonts/LeagueSpartan-VariableFont_wght.ttf', import.meta.url));
  const scene = { layers: [], camera: { center: [0, 0], zoom: 1, bearing: 0 }, size: [1200, 630], format: 'jpg' };
  const plan = { version: 2, epoch: 0, assets: { images: {}, data: {} }, layers: {}, resources: {},
    fonts: { display: { family: 'League Spartan', base64: font.toString('base64') } },
    jobs: [ { ...scene, id: 'clean' }, { ...scene, id: 'social', textOverlay: {
      title: 'Atlas & <maps> "à la mer"', subtitle: 'A short subtitle', font: 'display',
    } } ],
  };
  const first = await renderBatch(plan, options);
  assert.notEqual(first.images.social.path, first.images.clean.path);
  const socialFile = path.join(options.outputRoot, first.images.social.path);
  const { data, info } = await sharp(socialFile).raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 1200);
  assert.equal(info.height, 630);
  // The halo follows the glyphs; both the top and bottom corners stay clear.
  const pixel = (x, y) => data[(y * info.width + x) * info.channels];
  assert.equal(pixel(0, 0), 255);
  assert.equal(pixel(10, 600), 255);
  let shadow = 0;
  for (let y = 430; y < 580; y++) for (let x = 56; x < 1144; x++) if (pixel(x, y) < 150) shadow++;
  assert.ok(shadow > 1000, 'title and subtitle must actually render with a halo');
  assert.deepEqual(await renderBatch(plan, options), first);
  const cacheBefore = await readdir(path.join(options.cacheRoot, 'renders-v2'));
  plan.jobs[1].textOverlay.title = 'Another title';
  const changed = await renderBatch(plan, options);
  assert.notEqual(changed.images.social.path, first.images.social.path);
  assert.equal(changed.images.clean.path, first.images.clean.path);
  const cacheAfter = await readdir(path.join(options.cacheRoot, 'renders-v2'));
  assert.equal(cacheAfter.length - cacheBefore.length, 2, 'only composition and encoding should change');
  // Long and unbroken text must wrap or shrink inside the available image area.
  plan.jobs[1].textOverlay.title = 'An unusually long title about maritime history and the people of the city '.repeat(4);
  plan.jobs[1].textOverlay.subtitle = 'long-unbroken-subtitle'.repeat(20);
  const long = await renderBatch(plan, options);
  assert.equal((await sharp(path.join(options.outputRoot, long.images.social.path)).metadata()).height, 630);
  const otherFont = await readFile(new URL('./fixtures/fonts/SourceSans3-VariableFont_wght.ttf', import.meta.url));
  plan.fonts.display = { family: 'Source Sans 3', base64: otherFont.toString('base64') };
  const differentFont = await renderBatch(plan, options);
  assert.notEqual(differentFont.images.social.path, long.images.social.path);
  assert.equal(differentFont.images.clean.path, first.images.clean.path);
});

test('unknown font references and empty text fail before rendering', () => {
  const plan = { version: 2, epoch: 0, assets: { images: {}, data: {} }, layers: {}, resources: {}, jobs: [
    { id: 'social', layers: [], camera: { center: [0, 0], zoom: 1, bearing: 0 }, size: [1200, 630], format: 'jpg', textOverlay: { title: 'Atlas', font: 'missing' } },
  ] };
  assert.throws(() => validateRenderPlan(plan), /Unknown render font/);
  plan.jobs[0].textOverlay = { title: ' ' };
  assert.throws(() => validateRenderPlan(plan), /Invalid text overlay/);
});
