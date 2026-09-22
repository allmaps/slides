import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSlidesConfig } from '../src/content/config.ts';
import { loadContent } from '../src/content/index.ts';
import { contentModule } from '../src/vite/index.ts';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-content-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'chapters'));
  await writeFile(path.join(root, 'slides.config.yml'), 'title: Directory only\nmain: main\nslideshows:\n - id: main\n   path: chapters\n');
  await writeFile(path.join(root, 'chapters/01-start.md'), '---\ntitle: Start\n---\nHello.');
  return root;
}

test('directory content works without package.json, exports, or an entry point', async t => {
  const root = await fixture(t);
  const config = await loadSlidesConfig({ content: root });
  const content = await loadContent(config);
  assert.equal(content.slideCount, 1);
  assert.equal(content.project.title, 'Directory only');
  assert.equal(content.project.slideshows[0].chapters[0].sourcePath, 'chapters/01-start.md');
  assert.match(contentModule(content), /chapters\/01-start.md/);
});

test('an explicit config is the same config exposed to the app', async t => {
  const root = await fixture(t);
  const configPath = path.join(root, 'production.yml');
  await writeFile(configPath, 'title: Selected configuration\nslideshows:\n - id: main\n   path: chapters\n');
  const content = await loadContent(await loadSlidesConfig({ content: root, configPath }));
  assert.equal(content.project.title, 'Selected configuration');
  const module = contentModule(content);
  assert.match(module, /Selected configuration/);
  assert.doesNotMatch(module, /Directory only|slidesConfigFiles/);
});

test('invalid references fail before rendering and content paths cannot escape the root', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'chapters/01-start.md'), '---\ntitle: Start\nsubslideshows: missing\n---\n');
  await assert.rejects(() => loadSlidesConfig({ content: root }).then(loadContent), /Unknown subslideshow/);
  await writeFile(path.join(root, 'slides.config.yml'), 'slideshows:\n - id: main\n   path: ../\n');
  await assert.rejects(() => loadSlidesConfig({ content: root }).then(loadContent), /outside its root/);
});

test('project working directories are isolated by root and selected configuration', async t => {
  const a = await fixture(t), b = await fixture(t);
  const one = await loadSlidesConfig({ content: a });
  const two = await loadSlidesConfig({ content: b });
  assert.notEqual(one.workDir, two.workDir);
  const configPath = path.join(a, 'alternate.yml');
  await writeFile(configPath, 'title: Alternate');
  assert.notEqual(one.workDir, (await loadSlidesConfig({ content: a, configPath })).workDir);
});
