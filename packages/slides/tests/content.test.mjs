import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadSlidesConfig } from '../src/content/config.ts';
import { loadContent } from '../src/content/index.ts';
import { contentModule, markdownModule } from '../src/vite/index.ts';

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

test('credits are per-slideshow Markdown and never become chapters', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'details'));
  await writeFile(path.join(root, 'details/01-detail.md'), '---\ntitle: Detail\n---\nDetail body');
  await writeFile(path.join(root, 'chapters/credits.md'), '# Acknowledgements\n\nBy **our contributors**.');
  await writeFile(path.join(root, 'detail-credits.md'), 'Sources for the detail story.');
  await writeFile(path.join(root, 'slides.config.yml'), 'title: Atlas\nmain: main\nslideshows:\n - id: main\n   path: chapters\n   credits: ./chapters/credits.md\n - id: detail\n   path: details\n   credits: detail-credits.md\n');
  const content = await loadContent(await loadSlidesConfig({ content: root }));
  assert.equal(content.slideCount, 2);
  assert.equal(content.project.slideshows[0].chapters.length, 1);
  assert.equal(content.project.slideshows[0].credits, './chapters/credits.md');
  assert.equal(content.credits.main.filename, path.join(content.config.sourceContentDir, 'chapters/credits.md'));
  assert.equal(content.credits.detail.filename, path.join(content.config.sourceContentDir, 'detail-credits.md'));
  const module = markdownModule(content);
  assert.match(module, /export const creditsFiles = \{"main": credit0,"detail": credit1\}/);
  assert.match(module, /import credit0 from .*chapters\/credits\.md/);
  assert.doesNotMatch(module.match(/export const slideFiles = .*;/)[0], /credits\.md/);
});

test('credits paths must name existing Markdown files within the content root', async t => {
  const root = await fixture(t);
  const load = () => loadSlidesConfig({ content: root }).then(loadContent);
  const setCredits = credits => writeFile(path.join(root, 'slides.config.yml'), `slideshows:\n - id: main\n   path: chapters\n   credits: ${credits}\n`);
  await setCredits('missing.md');
  await assert.rejects(load, /Credits file not found for main/);
  await setCredits('../outside.md');
  await assert.rejects(load, /outside its root/);
  await setCredits('credits.html');
  await assert.rejects(load, /must be a Markdown/);
  await mkdir(path.join(root, 'directory.md'));
  await setCredits('directory.md');
  await assert.rejects(load, /Credits file not found/);
  const outside = await fixture(t);
  await symlink(path.join(outside, 'chapters/01-start.md'), path.join(root, 'linked.md'));
  await setCredits('linked.md');
  await assert.rejects(load, /outside its root/);
});

test('shared credits are excluded from chapters and preserve their frontmatter title alongside per-story credits', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'chapters/credits.md'), '---\ntitle: Colofon\n---\nShared contributors.');
  await writeFile(path.join(root, 'extra.md'), '---\ntitle: Map sources\n---\nStory contributors.');
  await writeFile(path.join(root, 'slides.config.yml'), 'title: Atlas\ncredits: chapters/credits.md\nslideshows:\n - id: main\n   path: chapters\n   credits: extra.md\ninterface:\n  text:\n    mapLayers: Kaarten\n');
  const content = await loadContent(await loadSlidesConfig({ content: root }));
  assert.equal(content.slideCount, 1);
  assert.equal(content.project.creditsTitle, 'Colofon');
  assert.equal(content.project.slideshows[0].creditsTitle, 'Map sources');
  assert.equal(content.project.interface.text.mapLayers, 'Kaarten');
  assert.match(markdownModule(content), /export const sharedCreditsFile = sharedCredit/);
  assert.match(markdownModule(content), /export const creditsFiles = \{"main": credit0\}/);
  await writeFile(path.join(root, 'chapters/credits.md'), '---\ntitle: [invalid]\n---\nCredits');
  await assert.rejects(() => loadContent(content.config), /Credits title for project must be a string/);
});
