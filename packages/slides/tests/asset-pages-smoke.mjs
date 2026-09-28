import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { buildSite } from '../src/build/index.ts';

const root = await realpath(await mkdtemp(path.join(tmpdir(), 'slides-asset-pages-')));
console.log(`Asset-page fixture: ${root}`);
const filename = path.join(root, 'slides.config.json');
const config = { title: 'Maritime archive', site: { publicUrl: 'https://example.org/demo/', basePath: '/demo' },
  iiif: { tiles: false, sizes: false, webp: false } };
const build = async name => {
  await writeFile(filename, JSON.stringify(config));
  await buildSite({ content: root, cwd: root, cacheDir: '.cache', outDir: name, thumbnailsEnabledOverride: null });
  return relative => readFile(path.join(root, name, relative), 'utf8');
};
try {
  await mkdir(path.join(root, 'assets/images'), { recursive: true });
  await sharp({ create: { width: 800, height: 600, channels: 3, background: '#b4d8c6' } })
    .composite([{ input: Buffer.from('<svg width="800" height="600"><circle cx="400" cy="300" r="160" fill="#396451"/></svg>') }])
    .png().toFile(path.join(root, 'assets/images/ship.png'));
  await mkdir(path.join(root, 'assets/images/ships'));
  await copyFile(path.join(root, 'assets/images/ship.png'), path.join(root, 'assets/images/ships/Ship detail.png'));
  const empty = await build('empty-site');
  assert.match(await empty('index.html'), /No slideshow content yet/);
  assert.match(await empty('index.html'), /href="\/demo\/iiif\/"/);
  assert.match(await empty('iiif/index.html'), /ship\/info.json/);
  const iiifOverview = await empty('iiif/index.html');
  assert.match(iiifOverview, /2 images/);
  assert.match(iiifOverview, /Maritime archive<\/span>.*?IIIF Collection/);
  assert.match(iiifOverview, /Ships<\/span>.*?IIIF Manifest/);
  assert.match(iiifOverview, /Copy URL: Maritime archive \(IIIF Collection\)/);
  assert.match(iiifOverview, /class="manifest-list/);
  for (const resource of ['collection.json', 'manifest.json', 'ships/manifest.json']) {
    const url = encodeURIComponent('https://example.org/demo/iiif/' + resource);
    assert.ok(iiifOverview.includes('https://editor.allmaps.org/mask?url=' + url));
    assert.ok(iiifOverview.includes('https://theseusviewer.org/?iiif-content=' + url));
  }
  assert.equal(JSON.parse(await empty('iiif/ship/info.json')).width, 800);
  assert.match(await empty('thumbnails/index.html'), /No generated images yet/);

  await mkdir(path.join(root, 'chapters'));
  await writeFile(path.join(root, 'chapters/01-first.md'), '---\ntitle: First chapter\n---\n![Original image](assets/images/ship.png)\n\n<figure data-image="assets/images/ship.png" aria-label="Ship in Atlas">\n<figcaption>Original image in Atlas</figcaption>\n</figure>\n');
  await writeFile(path.join(root, 'chapters/02-second.md'), '---\ntitle: Second chapter\n---\nA second set of previews.\n');
  config.slideshows = [{ id: 'main', path: 'chapters' }];
  config.iiif.enabled = false;
  config.thumbnails = { enabled: false };
  config.map = { styles: Object.fromEntries(['light', 'dark'].map(theme => [theme, {
    version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#b4d8c6' } }],
  }])) };
  const disabled = await build('disabled-site');
  assert.match(await disabled('index.html'), /alt="Original image"/);
  assert.doesNotMatch(await disabled('index.html'), /data-iiif-image|property="og:image"/);
  assert.match(await disabled('iiif/index.html'), /disabled/);
  assert.match(await disabled('thumbnails/index.html'), /disabled/);
  assert.ok((await readdir(path.join(root, 'disabled-site/iiif'))).every(name => ['index.html', '__data.json'].includes(name)));

  config.thumbnails.enabled = true;
  const previews = await build('preview-site');
  const html = await previews('thumbnails/index.html');
  assert.match(html, /First chapter/);
  assert.match(html, /Open Graph/);
  assert.match(html, /aria-label="Table of contents"/);
  assert.match(html, /aria-label="Expand all"/);
  assert.match(html, /href="#thumbnails-show-1-slide-2"/);
  assert.match(html, /id="thumbnails-show-1-slide-2"/);
  assert.match(html, /class="thumbnail-row/);
  const social = (await previews('index.html')).match(/property="og:image" content="https:\/\/example.org\/demo\/(thumbnails\/[^\"]+)"/)?.[1];
  assert.ok(social, 'social image is advertised by the slideshow');
  assert.ok(html.includes(`/demo/${social}`), 'the same image is identified in the overview');
  console.log('PASS: images-only build, disabled generators, plain images, thumbnail overview/social tags and base-path URLs');
} finally {
  if (process.env.KEEP_SLIDES_ASSETS === '1') console.log(`Kept asset-page fixture: ${root}`);
  else await rm(root, { recursive: true, force: true });
}
