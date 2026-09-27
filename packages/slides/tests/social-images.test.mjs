import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadSlidesConfig } from "../src/content/config.ts";
import { loadContent } from "../src/content/index.ts";
import { prepareThumbnails } from "../src/build/prepare.ts";

test("social scenes use overall short copy, subslideshow titles and a caller-supplied font", async t => {
  const root = await mkdtemp(path.join(tmpdir(), "slides-social-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const style = { version: 8, sources: {}, layers: [] };
  const font = await readFile(new URL('../../../apps/slides/static/fonts/SourceSans3-VariableFont_wght.ttf', import.meta.url));
  await writeFile(path.join(root, 'custom.ttf'), font);
  const config = {
    title: { short: 'Atlas', long: 'A very long atlas title for search' },
    description: { short: 'Explore the city', long: 'A longer description for search' },
    main: 'main',
    slideshows: [
      { id: 'main', path: 'main', title: 'Main story', description: 'Do not use this summary' },
      { id: 'history', path: 'history', title: 'The early years', description: 'Do not use this as the subtitle' },
    ],
    socialImage: { font: { family: 'Source Sans 3', path: 'custom.ttf' } },
    map: { styles: { light: style, dark: style } },
  };
  for (const show of config.slideshows) {
    await mkdir(path.join(root, show.path));
    await writeFile(path.join(root, show.path, '01-first.md'), '---\ntitle: First chapter\n---\nBody');
  }
  const configPath = path.join(root, 'slides.config.json');
  await writeFile(configPath, JSON.stringify(config));
  const prepare = async () => prepareThumbnails(await loadContent(await loadSlidesConfig({ content: root })), {
    assetRoot: root, cacheRoot: path.join(root, 'cache'), annotationsRoot: path.join(root, 'annotations'), offline: true, refresh: false,
  });
  const { plan, manifest } = await prepare();
  const scene = image => plan.jobs.find(job => job.id === image.path);
  assert.deepEqual(scene(manifest.social.main).textOverlay, { title: 'Atlas', subtitle: 'Explore the city', font: 'title' });
  assert.deepEqual(scene(manifest.social.history).textOverlay, { title: 'Atlas', subtitle: 'The early years', font: 'title' });
  assert.equal(plan.fonts.title.base64, font.toString('base64'));
  assert.equal(plan.fonts.title.family, 'Source Sans 3');
  assert.equal(scene(manifest.social.main).format, 'jpg');
  assert.deepEqual(scene(manifest.social.main).size, [1200, 630]);
  for (const previews of Object.values(manifest.slides))
    for (const image of Object.values(previews)) assert.equal(scene(image).textOverlay, undefined);
  config.socialImage.font.path = '../outside.ttf';
  await writeFile(configPath, JSON.stringify(config));
  await assert.rejects(prepare, /outside its root|ENOENT/);
});
