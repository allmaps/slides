import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, realpath, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const root = await mkdtemp(path.join(tmpdir(), 'slides-package-consumer-'));
const archives = path.join(root, 'archives'); await mkdir(archives);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const run = (args, cwd = root, env = {}) => execFileSync(pnpm, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env }, timeout: 240_000 });
try {
  const overrides = {};
  for (const name of ['iiif', 'static-render', 'svelte-canvas-panel', 'slides']) {
    const cwd = path.join(repository, 'packages', name);
    run(['pack', '--pack-destination', archives], cwd);
    const pkg = JSON.parse(await readFile(path.join(cwd, 'package.json')));
    const archive = path.join(archives, pkg.name.replace('@', '').replace('/', '-') + '-' + pkg.version + '.tgz');
    overrides[pkg.name] = 'file:' + archive;
  }
  // Temporary consumer workaround: annotation beta.37 is incompatible with
  // Zod 4.6.5. Keep this visible and remove it after the upstream schema fix.
  overrides.zod = '4.4.3';
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'content-only-consumer', private: true, type: 'module',
    devDependencies: { '@allmaps/slides': overrides['@allmaps/slides'] },
    pnpm: { overrides, onlyBuiltDependencies: ['esbuild', 'sharp', '@maplibre/maplibre-gl-native'] },
  }, null, 2));
  run(['install', '--ignore-workspace']);
  const installed = path.join(root, 'node_modules/@allmaps/slides');
  const pkg = JSON.parse(await readFile(path.join(installed, 'package.json')));
  assert.equal(pkg.exports['./model'].default, './dist/model/index.js');
  assert.equal(pkg.exports['./build'].default, './dist/build/index.js');
  await assert.rejects(() => stat(path.join(installed, 'src')), { code: 'ENOENT' });
  // Authored content has no JavaScript entry point or exported content package.
  await mkdir(path.join(root, 'chapters'));
  await mkdir(path.join(root, 'assets/images'), { recursive: true });
  await mkdir(path.join(root, 'assets/map-styles'), { recursive: true });
  await sharp({ create: { width: 24, height: 16, channels: 3, background: '#c52e27' } }).png().toFile(path.join(root, 'assets/images/ship.png'));
  await writeFile(path.join(root, 'assets/map-styles/plain.json'), JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#aaddcc' } }] }));
  const config = { title: 'Packed site', main: 'main', slideshows: [{ id: 'main', path: 'chapters' }], site: { publicUrl: 'https://example.org/story/', basePath: '/story' },
    map: { styles: { light: 'assets/map-styles/plain.json', dark: 'assets/map-styles/plain.json' } }, iiif: { sizes: false, tiles: false, webp: false } };
  await writeFile(path.join(root, 'slides.config.json'), JSON.stringify(config));
  await writeFile(path.join(root, 'chapters/01-first.md'), '---\ntitle: First chapter\n---\nA packaged story.\n\n![Ship](assets/images/ship.png)');
  const before = (await stat(installed)).mtimeMs;
  run(['exec', 'slides', 'validate', '.']);
  const diagnostics = execFileSync(pnpm, ['exec', 'slides', 'check', '.', '--output', 'machine'], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  console.log(diagnostics);
  assert.ok(Number(diagnostics.match(/COMPLETED (\d+) FILES/)?.[1]) > 10, 'svelte-check must actually check the packaged application');
  run(['exec', 'slides', 'build', '.', '--outDir', 'site']);
  const html = await readFile(path.join(root, 'site/index.html'), 'utf8');
  assert.match(html, /First chapter/);
  assert.match(html, /https:\/\/example.org\/story\//);
  const info = JSON.parse(await readFile(path.join(root, 'site/iiif/ship/info.json')));
  assert.equal(info.id, 'https://example.org/story/iiif/ship');
  assert.equal(info.width, 24);
  const rendered = await readdir(path.join(root, 'site/thumbnails'));
  assert.ok(rendered.some(name => name.endsWith('.webp')) && rendered.some(name => name.endsWith('.jpg')));
  // A repeat build must reuse pixels. It still exports every public asset.
  run(['exec', 'slides', 'build', '.', '--outDir', 'site']);
  assert.deepEqual(await readdir(path.join(root, 'site/thumbnails')), rendered);
  await assert.rejects(() => stat(path.join(installed, 'app/.svelte-kit')), { code: 'ENOENT' });
  assert.equal((await stat(installed)).mtimeMs, before);
  console.log(`PASS: packed content-only consumer with native thumbnails, IIIF, type checking, subpath URLs and repeat build: ${root}`);
} finally {
  if (process.env.KEEP_SLIDES_CONSUMER === '1') console.log(`Kept consumer: ${root}`);
  else await rm(root, { recursive: true, force: true });
}
