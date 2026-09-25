import assert from 'node:assert/strict';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, stat, writeFile, rm, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import sharp from 'sharp';
import { loadSlidesConfig } from '../src/content/config.ts';
import { thumbnailPaths } from '../src/build/thumbnails.ts';
import { iiifCatalogPath } from '../src/build/iiif.ts';

const root = await mkdtemp(path.join(tmpdir(), 'slides-dev-smoke-'));
const children = [], sockets = [];
const cacheDir = path.join(root, 'cache');
const cli = new URL('../bin/slides.js', import.meta.url).pathname;
const generateIiif = (content, ...args) => promisify(execFile)(process.execPath,
  [cli, 'iiif', content, '--cacheDir', cacheDir, ...args], { timeout: 60_000 });
async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function until(fn, label) {
  const end = Date.now() + 60_000;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out: ${label}\n${last ?? ''}\n${children.map(c => c.log).join('\n')}`);
}
async function start(name) {
  const content = path.join(root, name), number = await port();
  await mkdir(path.join(content, 'chapters'), { recursive: true });
  await mkdir(path.join(content, 'assets/images'), { recursive: true });
  const config = { title: name, main: 'main', slideshows: [{ id: 'main', path: 'chapters' }], iiif: { tiles: false, sizes: false, webp: false } };
  await writeFile(path.join(content, 'slides.config.json'), JSON.stringify(config));
  await writeFile(path.join(content, 'chapters/01-first.md'), `---\ntitle: ${name} first\n---\n${name} body`);
  const image = color => sharp({ create: { width: 16, height: 16, channels: 3, background: color } }).png().toFile(path.join(content, 'assets/images/shared.png'));
  await image(name === 'Alpha' ? '#ff0000' : '#0000ff');
  const child = spawn(process.execPath, [cli, 'dev', content, '--cacheDir', cacheDir, '--host', '127.0.0.1', '--port', String(number), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const entry = { child, log: '' }; children.push(entry);
  child.stdout.on('data', bytes => entry.log += bytes); child.stderr.on('data', bytes => entry.log += bytes);
  const origin = `http://127.0.0.1:${number}`;
  const get = async url => fetch(origin + url, { signal: AbortSignal.timeout(10_000) });
  await until(async () => { const response = await get('/'); return response.ok && (await response.text()).includes(`${name} first`); }, `${name} startup`);
  return { content, config, origin, get, image, child };
}
try {
  const a = await start('Alpha'), b = await start('Beta');
  const config = await loadSlidesConfig({ content: a.content, cacheDir });
  const catalogPath = iiifCatalogPath(config);
  assert.notEqual(config.workDir, (await loadSlidesConfig({ content: b.content, cacheDir })).workDir);
  assert.equal((await a.get('/iiif/shared/info.json')).status, 404);
  assert.equal((await b.get('/iiif/shared/info.json')).status, 404);
  await assert.rejects(() => stat(catalogPath), { code: 'ENOENT' });
  const client = await (await a.get('/@vite/client')).text();
  const token = client.match(/const wsToken = "([^"]+)"/)[1];
  const socket = new WebSocket(a.origin.replace('http', 'ws') + '/?token=' + token, 'vite-hmr'); sockets.push(socket);
  const events = [];
  socket.addEventListener('message', event => events.push(JSON.parse(event.data)));
  await until(() => events.some(e => e.type === 'connected'), 'HMR connection');
  const exportDir = path.join(root, 'iiif-export');
  await generateIiif(a.content, '--output', exportDir);
  await until(() => events.some(e => e.type === 'full-reload'), 'explicit IIIF completion');
  await generateIiif(b.content);
  const first = Buffer.from(await (await a.get('/iiif/shared/full/max/0/default.jpg')).arrayBuffer());
  const other = Buffer.from(await (await b.get('/iiif/shared/full/max/0/default.jpg')).arrayBuffer());
  assert.notDeepEqual(first, other);
  assert.deepEqual(await readFile(path.join(exportDir, 'shared/full/max/0/default.jpg')), first);
  const catalogBytes = await readFile(catalogPath, 'utf8');
  const catalog = JSON.parse(catalogBytes);
  assert.ok(!Object.keys(catalog.assets).some(request => request.endsWith('.webp')), 'CLI respects configured webp: false');
  const publishedAt = (await stat(catalogPath)).mtimeMs;
  const reloadCount = events.filter(e => e.type === 'full-reload').length;
  await writeFile(path.join(a.content, 'chapters/02-added.md'), '---\ntitle: Added chapter\n---\nAdded body');
  await until(async () => (await (await a.get('/')).text()).includes('Added chapter'), 'add Markdown');
  await until(() => events.filter(e => e.type === 'full-reload').length > reloadCount, 'browser reload event');
  await rename(path.join(a.content, 'chapters/02-added.md'), path.join(a.content, 'chapters/02-renamed.md'));
  await until(async () => (await (await a.get('/')).text()).includes('#renamed'), 'rename Markdown');
  await rm(path.join(a.content, 'chapters/02-renamed.md'));
  await until(async () => !(await (await a.get('/')).text()).includes('Added chapter'), 'delete Markdown');
  await writeFile(path.join(a.content, 'assets/new.json'), '{"new":true}');
  await until(async () => (await a.get('/api/new.json')).status === 200, 'add data asset');
  await a.image('#00ff00');
  assert.deepEqual(Buffer.from(await (await a.get('/iiif/shared/full/max/0/default.jpg')).arrayBuffer()), first);
  assert.equal((await stat(catalogPath)).mtimeMs, publishedAt, 'requests and edits do not regenerate IIIF');
  // A failed batch must leave the completed catalog and its old pixels available.
  const duplicate = path.join(a.content, 'assets/images/shared.jpg');
  await sharp(path.join(a.content, 'assets/images/shared.png')).jpeg().toFile(duplicate);
  await assert.rejects(() => generateIiif(a.content), /same IIIF id/);
  assert.equal(await readFile(catalogPath, 'utf8'), catalogBytes);
  assert.deepEqual(Buffer.from(await (await a.get('/iiif/shared/full/max/0/default.jpg')).arrayBuffer()), first);
  await rm(duplicate);
  await generateIiif(a.content);
  await until(async () => !first.equals(Buffer.from(await (await a.get('/iiif/shared/full/max/0/default.jpg')).arrayBuffer())), 'replace image');
  assert.equal((await (await a.get('/iiif/shared/info.json')).json()).id, a.origin + '/iiif/shared');
  await rm(path.join(a.content, 'assets/images/shared.png'));
  assert.equal((await a.get('/iiif/shared/info.json')).status, 200);
  await generateIiif(a.content);
  await until(async () => (await a.get('/iiif/shared/info.json')).status === 404, 'remove image');
  const paths = thumbnailPaths(await loadSlidesConfig({ content: a.content, cacheDir }));
  assert.equal(events.filter(e => e.type === 'full-reload').length > 0, true);
  const count = events.filter(e => e.type === 'full-reload').length;
  await writeFile(paths.manifestPath, JSON.stringify({ slides: {}, layers: {}, social: {}, annotations: {} }));
  await until(() => events.filter(e => e.type === 'full-reload').length > count, 'explicit thumbnail completion');
  a.config.title = 'Updated configuration';
  await writeFile(path.join(a.content, 'slides.config.json'), JSON.stringify(a.config));
  await until(async () => (await (await a.get('/')).text()).includes('Updated configuration'), 'configuration restart');
  a.config.site = { basePath: '/atlas', publicUrl: 'https://example.org/atlas' };
  await a.image('#ffff00');
  await writeFile(path.join(a.content, 'slides.config.json'), JSON.stringify(a.config));
  await until(async () => { const response = await a.get('/atlas/'); return response.ok && (await response.text()).includes('Updated configuration'); }, 'base path restart');
  assert.equal((await a.get('/atlas/iiif/shared/info.json')).status, 404);
  await generateIiif(a.content);
  await until(async () => (await (await a.get('/atlas/iiif/shared/info.json')).json()).id === a.origin + '/atlas/iiif/shared', 'IIIF after base path restart');
  assert.ok((await (await b.get('/')).text()).includes('Beta first'));
  sockets.forEach(socket => socket.close());
  for (const [site, signal, expectedCode] of [[a, 'SIGINT', 130], [b, 'SIGTERM', 143]]) {
    const stopped = new Promise(resolve => site.child.once('close', (code, signal) => resolve({ code, signal })));
    site.child.kill(signal);
    assert.deepEqual(await stopped, { code: expectedCode, signal: null });
    assert.doesNotMatch(children.find(entry => entry.child === site.child).log, /Command failed|CommandInterruptedError/);
    await assert.rejects(() => site.get('/'));
  }
  console.log('PASS: explicit IIIF batches, missing/failed batches, exports, stable dev URLs, isolated pixels, add/rename/delete, data assets, HMR, thumbnails, config/base-path restart and clean SIGINT/SIGTERM shutdown.');
} finally {
  sockets.forEach(socket => socket.close());
  await Promise.all(children.map(({ child }) => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('exit', resolve); child.kill('SIGTERM');
  })));
  await rm(root, { recursive: true, force: true });
}
