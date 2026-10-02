import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm, realpath, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import sharp from 'sharp';
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const root = await mkdtemp(path.join(tmpdir(), 'slides-package-consumer-'));
const archives = path.join(root, 'archives'); await mkdir(archives);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const run = (args, cwd = root, env = {}) => execFileSync(pnpm, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env }, timeout: 240_000 });
async function checkDevServer(installed) {
  const child = spawn(process.execPath, [path.join(installed, 'bin/slides.js'), 'dev', '.', '--host', '127.0.0.1', '--port', '0'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '1' } });
  const closed = new Promise(resolve => child.once('close', resolve));
  let log = '';
  child.stdout.on('data', data => log += data);
  child.stderr.on('data', data => log += data);
  try {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline && child.exitCode === null) {
      // CI colors the port separately; exercise that output even in local runs.
      const origin = stripVTControlCharacters(log).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
      if (origin) {
        // Vite may still be compiling the app after it prints the server URL.
        const response = await fetch(`${origin}/story/`, { signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())) });
        assert.equal(response.status, 200, log);
        assert.match(await response.text(), /First chapter/);
        const info = await fetch(`${origin}/story/iiif/ship/info.json`);
        assert.equal(info.status, 200, log);
        assert.equal((await info.json()).id, `${origin}/story/iiif/ship`);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Packaged dev server did not start:\n${log}`);
  } finally {
    child.kill('SIGTERM');
    await closed;
  }
}
try {
  const cwd = path.join(repository, 'packages/slides');
  run(['pack', '--pack-destination', archives], cwd);
  const sourcePackage = JSON.parse(await readFile(path.join(cwd, 'package.json')));
  const archive = path.join(archives, `allmaps-slides-${sourcePackage.version}.tgz`);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'content-only-consumer', private: true, type: 'module',
    devDependencies: { '@allmaps/slides': 'file:' + archive },
    pnpm: { onlyBuiltDependencies: ['esbuild', 'sharp', '@maplibre/maplibre-gl-native'] },
  }, null, 2));
  run(['install', '--ignore-workspace']);
  const installed = path.join(root, 'node_modules/@allmaps/slides');
  const pkg = JSON.parse(await readFile(path.join(installed, 'package.json')));
  const stamp = JSON.parse(await readFile(path.join(installed, 'build-info.json')));
  assert.equal(stamp.version, pkg.version);
  assert.match(stamp.revision, /^[a-f0-9]{40,64}$/);
  assert.equal(execFileSync(process.execPath, [path.join(installed, 'bin/slides.js'), '--version'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, npm_package_version: '99.9.9', GITHUB_SHA: 'private-content-sha' },
  }).trim(), pkg.version);
  assert.equal(pkg.license, 'SEE LICENSE IN LICENSE.md');
  // The release must carry both scopes and the complete content permission.
  const noticeFiles = ['LICENSE.md', 'static/licenses/GPL-3.0.txt',
    'static/licenses/CONTENT-PERMISSION.txt', 'static/licenses/MIT.txt',
    'static/licenses/NOTICE.txt', 'static/fonts/OFL.txt', 'static/fonts/SourceSans3-OFL.txt'];
  assert.equal(await readFile(path.join(installed, 'LICENSE.md'), 'utf8'),
    await readFile(path.join(cwd, 'LICENSE.md'), 'utf8'));
  for (const filename of noticeFiles)
    assert.equal(await readFile(path.join(installed, 'app', filename), 'utf8'),
      await readFile(path.join(repository, 'apps/slides', filename), 'utf8'), `Missing or changed release notice: ${filename}`);
  assert.equal(pkg.exports['./model'].default, './dist/model/index.js');
  assert.equal(pkg.exports['./build'].default, './dist/build/index.js');
  for (const name of ['@allmaps/iiif', '@allmaps/static-render', '@allmaps/svelte-canvas-panel'])
    assert.equal(pkg.dependencies[name], undefined, `${name} must be included, not installed from npm`);
  for (const entry of Object.values(pkg.exports)) {
    for (const filename of typeof entry === 'string' ? [entry] : Object.values(entry))
      assert.ok((await stat(path.join(installed, filename))).isFile(), `Missing package export: ${filename}`);
  }
  for (const filename of await readdir(path.join(installed, 'dist'), { recursive: true })) {
    if (!/\.(?:js|ts|svelte)$/.test(filename)) continue;
    const source = await readFile(path.join(installed, 'dist', filename), 'utf8');
    assert.doesNotMatch(source, /(?:from\s*|import\s*\(?\s*)["']@allmaps\/(?:iiif|static-render|svelte-canvas-panel)(?:\/|["'])/,
      `Unpublished workspace import in ${filename}`);
  }
  await assert.rejects(() => stat(path.join(installed, 'src')), { code: 'ENOENT' });
  // Authored content has no JavaScript entry point or exported content package.
  await mkdir(path.join(root, 'chapters'));
  await mkdir(path.join(root, 'assets/images'), { recursive: true });
  await mkdir(path.join(root, 'assets/map-styles'), { recursive: true });
  await sharp({ create: { width: 24, height: 16, channels: 3, background: '#c52e27' } }).png().toFile(path.join(root, 'assets/images/ship.png'));
  await writeFile(path.join(root, 'assets/map-styles/plain.json'), JSON.stringify({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#aaddcc' } }] }));
  const config = { title: { short: 'Packed site', long: 'Packed site — an atlas through time' },
    description: { short: 'Explore our atlas', long: 'A detailed description for search and sharing' },
    main: 'main', slideshows: [{ id: 'main', path: 'chapters', description: 'Main slideshow fallback' }], site: { publicUrl: 'https://example.org/story/', basePath: '/story' },
    map: { styles: { light: 'assets/map-styles/plain.json', dark: 'assets/map-styles/plain.json' } },
    socialImage: { textOverlay: true }, iiif: { sizes: false, tiles: false, webp: false } };
  await writeFile(path.join(root, 'slides.config.json'), JSON.stringify(config));
  await writeFile(path.join(root, 'chapters/01-first.md'), '---\ntitle: First chapter\n---\nA packaged story.\n\n![Ship](assets/images/ship.png)');
  const before = (await stat(installed)).mtimeMs;
  run(['exec', 'slides', 'validate', '.']);
  const diagnostics = execFileSync(pnpm, ['exec', 'slides', 'check', '.', '--output', 'machine'], { cwd: root, encoding: 'utf8', timeout: 120_000 });
  console.log(diagnostics);
  assert.ok(Number(diagnostics.match(/COMPLETED (\d+) FILES/)?.[1]) > 10, 'svelte-check must actually check the packaged application');
  run(['exec', 'slides', 'build', '.', '--outDir', 'site'], root, { npm_package_version: '99.9.9', GITHUB_SHA: 'private-content-sha' });
  const html = await readFile(path.join(root, 'site/index.html'), 'utf8');
  const siteBuild = JSON.parse(await readFile(path.join(root, 'site/_app/slides-build.json')));
  assert.deepEqual(siteBuild, JSON.parse(JSON.stringify({ ...stamp, customApp: false, applicationSourceUrl: stamp.sourceUrl })));
  assert.doesNotMatch(JSON.stringify(siteBuild), /private-content-sha|99\.9\.9|slides-package-consumer-/);
  const licenseHref = html.match(/rel="license" href="([^"]+)"/)?.[1];
  assert.ok(licenseHref, 'The built page must link to its software notice');
  assert.equal(new URL(licenseHref, config.site.publicUrl).href, 'https://example.org/story/licenses/NOTICE.txt');
  for (const filename of noticeFiles.filter(name => name.startsWith('static/')))
    assert.equal(await readFile(path.join(root, 'site', filename.slice('static/'.length)), 'utf8'),
      await readFile(path.join(installed, 'app', filename), 'utf8'), `Missing or changed site notice: ${filename}`);
  assert.match(await readFile(path.join(root, 'site/_app/licenses/dependencies.md'), 'utf8'), /maplibre-gl/);
  assert.match(html, /First chapter/);
  assert.match(html, /<title>Packed site — an atlas through time<\/title>/);
  assert.match(html, /name="description" content="A detailed description for search and sharing"/);
  // The start modal mounts after theme detection; the prerendered header and
  // image description still expose the overall short copy.
  assert.match(html, /title="Packed site"/);
  assert.match(html, /property="og:image:alt" content="Packed site — Explore our atlas"/);
  assert.match(html, /https:\/\/example.org\/story\//);
  const siteFiles = await readdir(path.join(root, 'site'), { recursive: true });
  const worker = siteFiles.find(file => /maplibre-gl-worker[^/]*\.js$/.test(file));
  assert.ok(worker, 'MapLibre needs an emitted worker in the static deployment');
  assert.doesNotMatch(await readFile(path.join(root, 'site', worker), 'utf8'), /from\s*["']\.\/maplibre-gl-shared\.mjs/);
  const info = JSON.parse(await readFile(path.join(root, 'site/iiif/ship/info.json')));
  assert.equal(info.id, 'https://example.org/story/iiif/ship');
  assert.equal(info.width, 24);
  const rendered = await readdir(path.join(root, 'site/thumbnails'));
  assert.ok(rendered.some(name => name.endsWith('.webp')) && rendered.some(name => name.endsWith('.jpg')));
  const social = rendered.find(name => name.endsWith('.jpg'));
  const socialPixels = await sharp(path.join(root, 'site/thumbnails', social)).raw().toBuffer({ resolveWithObject: true });
  const { data: pixels, info: imageInfo } = socialPixels;
  assert.equal(imageInfo.width, 1200);
  assert.equal(imageInfo.height, 630);
  assert.ok(Math.abs(pixels[(600 * 1200 + 10) * imageInfo.channels] - pixels[(10 * 1200 + 10) * imageInfo.channels]) < 5,
    'the text halo leaves the lower corner of the map clear');
  let white = 0;
  for (let y = 400; y < 580; y++) for (let x = 56; x < 1144; x++)
    if (pixels[(y * 1200 + x) * imageInfo.channels] > 235) white++;
  assert.ok(white > 1000, 'the packaged app supplies its font and renders the sharing title');
  await checkDevServer(installed);
  // A repeat build must reuse pixels. It still exports every public asset.
  run(['exec', 'slides', 'build', '.', '--outDir', 'site']);
  assert.deepEqual(await readdir(path.join(root, 'site/thumbnails')), rendered);
  await assert.rejects(() => stat(path.join(installed, 'app/.svelte-kit')), { code: 'ENOENT' });
  assert.equal((await stat(installed)).mtimeMs, before);
  console.log(`PASS: single-package consumer with native thumbnails, IIIF, type checking, dev server, subpath URLs and repeat build: ${root}`);
} finally {
  if (process.env.KEEP_SLIDES_CONSUMER === '1') console.log(`Kept consumer: ${root}`);
  else await rm(root, { recursive: true, force: true });
}
