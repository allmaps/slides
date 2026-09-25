import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildStaticIiif, parseIiifOptions } from '../src/core.ts';
import { readIiifCatalog, writeIiifCatalog } from '../src/catalog.ts';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'iiif-catalog-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = path.join(root, 'images');
  await mkdir(input);
  const source = path.join(input, 'ship.png');
  const image = background => sharp({ create: { width: 16, height: 16, channels: 3, background } }).png().toFile(source);
  const options = (output, url = 'https://one.example.org') => parseIiifOptions(url,
    { input, output, tiles: false, sizes: false, webp: false }, { inputRoot: input, outputRoot: output });
  return { root, input, source, image, options };
}

test('changed source bytes invalidate derivatives even with unchanged dimensions and filename', async t => {
  const f = await fixture(t), output = path.join(f.root, 'public');
  await f.image('#ff0000');
  const before = await buildStaticIiif(f.options(output));
  const filename = before.assets['ship/full/max/0/default.jpg'].filename;
  const bytes = await readFile(filename);
  await f.image('#0000ff');
  await buildStaticIiif(f.options(output));
  assert.notDeepEqual(await readFile(filename), bytes);
});

test('publication URLs are stable while identical pixels share a cache across sites', async t => {
  const f = await fixture(t), cacheRoot = path.join(f.root, 'cache');
  await f.image('#ff0000');
  const one = await buildStaticIiif(f.options(path.join(f.root, 'one')), { cacheRoot });
  const file = one.assets['ship/full/max/0/default.jpg'].filename;
  const before = await stat(file);
  const two = await buildStaticIiif(f.options(path.join(f.root, 'two'), 'https://two.example.org/atlas'), { cacheRoot });
  assert.equal(two.assets['ship/full/max/0/default.jpg'].filename, file);
  assert.equal((await stat(file)).mtimeMs, before.mtimeMs);
  assert.equal(JSON.parse(await readFile(one.assets['ship/info.json'].filename)).id, 'https://one.example.org/iiif/ship');
  assert.equal(JSON.parse(await readFile(two.assets['ship/info.json'].filename)).id, 'https://two.example.org/atlas/iiif/ship');
  await f.image('#0000ff');
  const changed = await buildStaticIiif(f.options(path.join(f.root, 'two'), 'https://two.example.org/atlas'), { cacheRoot });
  assert.notEqual(changed.assets['ship/full/max/0/default.jpg'].filename, file);
  assert.equal(JSON.parse(await readFile(changed.assets['ship/info.json'].filename)).id, 'https://two.example.org/atlas/iiif/ship');
});

test('separate processes can publish the same cold pixel cache concurrently', async t => {
  const f = await fixture(t), cacheRoot = path.join(f.root, 'cache');
  await f.image('#778899');
  const core = new URL('../src/core.ts', import.meta.url).href;
  await Promise.all(['one', 'two'].map(site => promisify(execFile)(process.execPath, ['--input-type=module', '-e',
    `import { buildStaticIiif } from ${JSON.stringify(core)}; await buildStaticIiif(${JSON.stringify(f.options(path.join(f.root, site)))}, ${JSON.stringify({ cacheRoot })});`,
  ])));
  const result = await buildStaticIiif(f.options(path.join(f.root, 'three')), { cacheRoot });
  assert.ok((await stat(result.assets['ship/full/max/0/default.jpg'].filename)).size > 0);
});

test('prepared catalogs serve only listed files and deletion removes obsolete public entries', async t => {
  const f = await fixture(t), output = path.join(f.root, 'public');
  await f.image('#ff0000');
  const result = await buildStaticIiif(f.options(output));
  const filename = path.join(f.root, 'catalog.json');
  await writeIiifCatalog(filename, result);
  const catalog = readIiifCatalog(filename);
  assert.equal((await catalog.get('ship/info.json')).status, 200);
  for (const request of ['../images/ship.png', '__proto__', 'ship/.source.json', 'missing']) assert.equal((await catalog.get(request)).status, 404);
  await rm(f.source);
  await writeIiifCatalog(filename, await buildStaticIiif(f.options(output), { failOnEmpty: false }));
  assert.deepEqual(await catalog.entries(), []);
  assert.equal((await catalog.get('ship/info.json')).status, 404);
});

test('a partial cache entry is regenerated and duplicate public IDs fail clearly', async t => {
  const f = await fixture(t), output = path.join(f.root, 'public'), cacheRoot = path.join(f.root, 'cache');
  await f.image('#ff0000');
  const result = await buildStaticIiif(f.options(output), { cacheRoot });
  const filename = result.assets['ship/full/max/0/default.jpg'].filename;
  await rm(filename);
  await buildStaticIiif(f.options(output), { cacheRoot });
  assert.ok((await stat(filename)).size > 0);
  await sharp(f.source).jpeg().toFile(path.join(f.input, 'ship.jpg'));
  await assert.rejects(() => buildStaticIiif(f.options(output)), /same IIIF id/);
});

test('development can serve an empty catalog without starting generation', async t => {
  const f = await fixture(t), filename = path.join(f.root, 'catalog.json');
  await f.image('#ff0000');
  const catalog = readIiifCatalog(filename, { allowMissing: true });
  assert.deepEqual(await catalog.entries(), []);
  assert.equal((await catalog.get('ship/info.json')).status, 404);
  await assert.rejects(() => stat(filename), { code: 'ENOENT' });
  await assert.rejects(() => readIiifCatalog(filename).entries(), { code: 'ENOENT' });
  await writeFile(filename, 'invalid json');
  await assert.rejects(() => catalog.entries(), SyntaxError);
});

test('prepared metadata follows the dev origin without rewriting pixels or published files', async t => {
  const f = await fixture(t), filename = path.join(f.root, 'catalog.json');
  await f.image('#ff0000');
  const result = await buildStaticIiif(f.options(path.join(f.root, 'public')));
  await writeIiifCatalog(filename, result);
  const catalog = readIiifCatalog(filename);
  const publicUrl = 'http://localhost:5174/atlas';
  for (const request of Object.keys(result.assets).filter(request => request.endsWith('.json'))) {
    const original = await (await catalog.get(request)).text();
    const local = await (await catalog.get(request, { publicUrl })).text();
    assert.ok(local.includes(publicUrl + '/iiif/'), request);
    assert.ok(!local.includes('https://one.example.org/iiif/'), request);
    assert.deepEqual(JSON.parse(await (await catalog.get(request)).text()), JSON.parse(original));
  }
  const request = 'ship/full/max/0/default.jpg';
  assert.deepEqual(Buffer.from(await (await catalog.get(request, { publicUrl })).arrayBuffer()), await readFile(result.assets[request].filename));
  const before = await readFile(filename, 'utf8');
  assert.equal(JSON.parse(before).publicUrl, 'https://one.example.org');
  await rm(result.assets[request].filename);
  assert.equal((await readIiifCatalog(filename, { allowMissing: true }).get(request)).status, 404);
  await assert.rejects(() => catalog.get(request), { code: 'ENOENT' });
});

test('custom IIIF ID bases are preserved when serving on a dev origin', async t => {
  const f = await fixture(t), filename = path.join(f.root, 'catalog.json');
  await f.image('#ff0000');
  const options = { ...f.options(path.join(f.root, 'public')), idBase: 'https://images.example.org/custom' };
  await writeIiifCatalog(filename, await buildStaticIiif(options));
  const response = await readIiifCatalog(filename).get('ship/info.json', { publicUrl: 'http://localhost:5174/atlas' });
  assert.equal((await response.json()).id, 'https://images.example.org/custom/ship');
});
