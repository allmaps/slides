import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { captureBuildInfo, getBuildInfo, siteBuildInfo } from '../src/build-info.ts';
import { slidesConfigSchema } from '../src/model/content-schema.ts';

const pkg = { name: '@allmaps/slides', version: '0.1.0-beta.1', repository: { url: 'https://github.com/allmaps/slides.git' } };
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-source-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = path.join(root, 'packages/slides');
  await mkdir(path.join(dir, 'src'), { recursive: true });
  await writeFile(path.join(dir, 'package.json'), JSON.stringify(pkg));
  await writeFile(path.join(dir, 'src/index.ts'), 'export const example = true;');
  git(root, 'init', '-q');
  git(root, 'add', '.');
  git(root, '-c', 'user.name=Slides test', '-c', 'user.email=slides@example.invalid', 'commit', '-qm', 'fixture', '--no-gpg-sign');
  return { root, dir };
}

test('source metadata identifies software while excluding content changes', async t => {
  const { root, dir } = await fixture(t);
  await mkdir(path.join(root, 'content/private-story'), { recursive: true });
  await writeFile(path.join(root, 'content/private-story/draft.md'), 'Private draft');
  const info = await captureBuildInfo(dir);
  assert.equal(info.version, pkg.version);
  assert.equal(info.sourceState, 'clean');
  assert.equal(info.development, true);
  assert.equal(info.revision, git(root, 'rev-parse', 'HEAD'));
  assert.equal(info.sourceUrl, `https://github.com/allmaps/slides/tree/${info.revision}`);
  assert.equal(info.releaseNotesUrl, undefined);
  assert.doesNotMatch(JSON.stringify(info), /private-story|Private draft|slides-source-/);
  await writeFile(path.join(dir, 'src/index.ts'), 'export const example = false;');
  const modified = await captureBuildInfo(dir, false);
  assert.equal(modified.sourceState, 'modified');
  assert.equal(modified.sourceUrl, undefined, 'A base commit must not be advertised as the modified source');
  assert.equal(modified.releaseNotesUrl, undefined);
});

test('installed metadata preserves the packaged revision, independently of consumer Git and environment', async t => {
  const { root, dir } = await fixture(t);
  const stamp = await captureBuildInfo(dir, false);
  const installed = path.join(root, 'content/private/node_modules/@allmaps/slides');
  await mkdir(installed, { recursive: true });
  await writeFile(path.join(installed, 'package.json'), JSON.stringify(pkg));
  await writeFile(path.join(installed, 'build-info.json'), JSON.stringify({ ...stamp, privatePath: root }));
  for (const [key, value] of Object.entries({ npm_package_version: '99.9.9', GITHUB_SHA: 'f'.repeat(40) })) {
    const original = process.env[key];
    t.after(() => {
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    });
    process.env[key] = value;
  }
  const info = await getBuildInfo(installed);
  assert.deepEqual(info, stamp);
  assert.equal(info.releaseNotesUrl, 'https://github.com/allmaps/slides/releases/tag/%40allmaps%2Fslides%400.1.0-beta.1');
  await writeFile(path.join(installed, 'build-info.json'), JSON.stringify({ ...stamp, version: '0.0.0' }));
  assert.equal((await getBuildInfo(installed)).sourceState, 'unknown');
  await rm(path.join(installed, 'build-info.json'));
  assert.equal((await getBuildInfo(installed)).revision, undefined, 'Missing metadata must not fall back to consumer Git');
});

test('custom apps use an explicit public source URL without exposing their local directory', async t => {
  const { dir } = await fixture(t);
  const info = await captureBuildInfo(dir, false);
  const custom = siteBuildInfo(info, { directory: '/private/custom-app', sourceUrl: 'https://github.com/example/fork/tree/abcd' });
  assert.equal(custom.applicationSourceUrl, 'https://github.com/example/fork/tree/abcd');
  assert.equal(custom.customApp, true);
  assert.doesNotMatch(JSON.stringify(custom), /private\/custom-app/);
  assert.equal(siteBuildInfo(info, { directory: 'custom-app' }).applicationSourceUrl, undefined);
  assert.equal(siteBuildInfo(info).applicationSourceUrl, info.sourceUrl);
  assert.equal(slidesConfigSchema.safeParse({ title: 'Story', app: { sourceUrl: 'javascript:alert(1)' } }).success, false);
});

test('Changesets advances the existing beta and graduates to the intended regular version', async t => {
  const { root, dir } = await fixture(t);
  await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'release-fixture', private: true, packageManager: 'pnpm@10.22.0' }));
  await writeFile(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
  await mkdir(path.join(root, '.changeset'));
  await writeFile(path.join(root, '.changeset/config.json'), await readFile(new URL('../../../.changeset/config.json', import.meta.url)));
  await writeFile(path.join(root, '.changeset/pre.json'), await readFile(new URL('../../../.changeset/pre.json', import.meta.url)));
  await writeFile(path.join(root, '.changeset/fix.md'), '---\n"@allmaps/slides": patch\n---\nFix a rendering issue.\n');
  await mkdir(path.join(root, 'packages/internal'));
  await writeFile(path.join(root, 'packages/internal/package.json'), JSON.stringify({name: 'internal',version:'0.0.1',private:true}));
  const cli = new URL('../../../node_modules/@changesets/cli/bin.js', import.meta.url);
  const run = (...args) => execFileSync(process.execPath, [cli.pathname, ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  run('version');
  assert.equal(JSON.parse(await readFile(path.join(dir, 'package.json'))).version, '0.1.0-beta.2');
  assert.equal(JSON.parse(await readFile(path.join(root, 'packages/internal/package.json'))).version, '0.0.1');
  assert.match(await readFile(path.join(dir, 'CHANGELOG.md'), 'utf8'), /Fix a rendering issue/);
  run('pre', 'exit');
  run('version');
  assert.equal(JSON.parse(await readFile(path.join(dir, 'package.json'))).version, '0.1.0');
});

test('release commands select the npm channel explicitly and tag only after successful publication', async t => {
  const { root, dir } = await fixture(t);
  await mkdir(path.join(root, 'scripts'));
  for (const name of ['check-release.mjs', 'publish-slides.mjs'])
    await writeFile(path.join(root, 'scripts', name), await readFile(new URL(`../../../scripts/${name}`, import.meta.url)));
  await symlink(new URL('../src/build-info.ts', import.meta.url), path.join(dir, 'src/build-info.ts'));
  await mkdir(path.join(root, '.changeset'));
  await writeFile(path.join(root, '.changeset/pre.json'), '{"mode":"pre","tag":"beta"}');
  await writeFile(path.join(dir, 'CHANGELOG.md'), `# Slides\n\n## ${pkg.version}\n\nInitial beta.\n`);
  await mkdir(path.join(root, 'mock-bin'));
  const mock = path.join(root, 'mock-bin/pnpm');
  // No registry operation or tag creation: record subprocess arguments instead.
  await writeFile(mock, `#!${process.execPath}\nrequire('node:fs').appendFileSync(process.env.RELEASE_TEST_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');\nprocess.exit(process.env.RELEASE_TEST_FAIL === '1' ? 1 : 0);\n`);
  await chmod(mock, 0o755);
  const commit = () => {
    git(root, 'add', '.');
    git(root, '-c', 'user.name=Slides test', '-c', 'user.email=slides@example.invalid', 'commit', '-qm', 'release fixture', '--no-gpg-sign');
  };
  commit();
  await mkdir(path.join(root, 'content'));
  const log = path.join(root, 'content/publish-log');
  const run = (env = {}) => execFileSync(process.execPath, [path.join(root, 'scripts/publish-slides.mjs')], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: `${path.dirname(mock)}${path.delimiter}${process.env.PATH}`, RELEASE_TEST_LOG: log, ...env },
  });
  const calls = async () => (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  const expected = tag => [
    ['--filter', '@allmaps/slides', 'publish', '--access', 'public', '--tag', tag, '--no-git-checks'],
    ['exec', 'changeset', 'git-tag'],
  ];
  run();
  assert.deepEqual(await calls(), expected('beta'));
  await writeFile(log, '');
  assert.throws(() => run({ RELEASE_TEST_FAIL: '1' }));
  assert.equal((await calls()).length, 1, 'Failed publication must not create a release tag');

  await writeFile(path.join(dir, 'package.json'), JSON.stringify({ ...pkg, version: '0.1.0' }));
  await writeFile(path.join(dir, 'CHANGELOG.md'), '# Slides\n\n## 0.1.0\n\nFirst regular release.\n');
  await rm(path.join(root, '.changeset/pre.json'));
  commit();
  await writeFile(log, '');
  run();
  assert.deepEqual(await calls(), expected('latest'));

  await writeFile(path.join(root, '.changeset/pending.md'), '---\n"@allmaps/slides": patch\n---\nPending fix.\n');
  commit();
  await writeFile(log, '');
  assert.throws(run, /pending changes/);
  assert.deepEqual(await calls(), [], 'Unversioned changes must block publication');
});
