import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { isVersionOnlyChange } from '../../../scripts/check-version-only.mjs';

const manifest = 'packages/slides/package.json';
const pkg = {
  name: '@allmaps/slides', version: '0.1.0-beta.2',
  dependencies: { sharp: '0.35.4' }, scripts: { build: 'node build.mjs' },
  exports: { '.': './dist/index.js' }, engines: { node: '>=24' },
};

async function fixture(t) {
  const cwd = await mkdtemp(path.join(tmpdir(), 'slides-version-only-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = async (file, text) => {
    await mkdir(path.dirname(path.join(cwd, file)), { recursive: true });
    await writeFile(path.join(cwd, file), text);
  };
  const writePackage = (fields = {}) => write(manifest, JSON.stringify({ ...pkg, version: '0.1.0-beta.3', ...fields }));
  const commit = () => { git('add', '.'); git('commit', '-qm', 'Fixture'); return git('rev-parse', 'HEAD'); };
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release@example.org');
  await writePackage({ version: pkg.version });
  await write('packages/slides/CHANGELOG.md', `# Slides\n\n## ${pkg.version}\n`);
  await write('.changeset/pre.json', '{"mode":"pre","tag":"beta"}');
  await write('.changeset/new-feature.md', '---\n"@allmaps/slides": patch\n---\nFeature.\n');
  const base = commit();
  await writePackage();
  return { cwd, base, git, write, writePackage, commit };
}

test('version-only changes include a beta bump, changelog and archived notes across multiple commits', async t => {
  const f = await fixture(t);
  f.commit();
  await f.write('packages/slides/CHANGELOG.md', '# Slides\n\n## 0.1.0-beta.3\n');
  await mkdir(path.join(f.cwd, '.changeset/pre'));
  await rename(path.join(f.cwd, '.changeset/new-feature.md'), path.join(f.cwd, '.changeset/pre/new-feature.md'));
  f.commit();
  assert.equal(isVersionOnlyChange(f.base, f), true);
});

test('version-only changes include a stable release that removes prerelease records', async t => {
  const f = await fixture(t);
  await f.writePackage({ version: '0.1.0' });
  await rm(path.join(f.cwd, '.changeset/pre.json'));
  await rm(path.join(f.cwd, '.changeset/new-feature.md'));
  f.commit();
  assert.equal(isVersionOnlyChange(f.base, f), true);
});

test('a depth-two PR merge checkout compares against main even when main advanced', async t => {
  const f = await fixture(t);
  f.git('checkout', '-b', 'release');
  f.commit();
  f.git('checkout', 'main');
  await f.write('apps/slides/src/app.ts', 'Already on main\n');
  const base = f.commit();
  f.git('merge', '--no-edit', 'release');
  const checkout = await mkdtemp(path.join(tmpdir(), 'slides-shallow-merge-'));
  t.after(() => rm(checkout, { recursive: true, force: true }));
  f.git('clone', '--depth', '2', pathToFileURL(f.cwd).href, checkout);
  assert.equal(isVersionOnlyChange(base, { cwd: checkout }), true);
});

test('code, configuration, dependencies and unknown paths still require full checks', async t => {
  for (const file of [
    'apps/slides/src/app.ts', 'pnpm-lock.yaml', 'package.json',
    '.changeset/config.json', '.changeset/pre/config.json',
    '.github/workflows/slides.yml', 'scripts/check-version-only.mjs',
    'content/slides-template/slides.md', 'LICENSE.md', 'unknown\nfile.md',
  ]) {
    await t.test(file, async t => {
      const f = await fixture(t);
      await f.write(file, 'Changed\n');
      f.commit();
      assert.equal(isVersionOnlyChange(f.base, f), false);
    });
  }
});

test('a version bump cannot conceal other manifest edits', async t => {
  for (const fields of [
    { name: 'other-package' }, { dependencies: { sharp: '0.36.0' } },
    { scripts: { build: 'node different.mjs' } }, { exports: {} }, { engines: { node: '>=26' } },
    { version: pkg.version }, { version: 'invalid' }, { version: 3 },
  ]) {
    await t.test(JSON.stringify(fields), async t => {
      const f = await fixture(t);
      await f.writePackage(fields);
      await f.write('packages/slides/CHANGELOG.md', '# Updated\n');
      f.commit();
      assert.equal(isVersionOnlyChange(f.base, f), false);
    });
  }
});

test('file deletions, symlinks, mode changes and malformed manifests cannot use the shortcut', async t => {
  for (const kind of ['deleted manifest', 'deleted changelog', 'symlink', 'executable', 'invalid JSON']) {
    await t.test(kind, async t => {
      const f = await fixture(t);
      if (kind === 'deleted manifest') await rm(path.join(f.cwd, manifest));
      if (kind === 'deleted changelog') await rm(path.join(f.cwd, 'packages/slides/CHANGELOG.md'));
      if (kind === 'symlink') await symlink('../package.json', path.join(f.cwd, '.changeset/linked.md'));
      if (kind === 'executable') await chmod(path.join(f.cwd, manifest), 0o755);
      if (kind === 'invalid JSON') await f.write(manifest, '{');
      f.commit();
      assert.equal(isVersionOnlyChange(f.base, f), false);
    });
  }
});

test('a later version commit does not hide earlier code changes in the PR', async t => {
  const f = await fixture(t);
  await f.write('apps/slides/src/app.ts', 'Changed\n');
  f.commit();
  await f.writePackage({ version: '0.1.0-beta.4' });
  f.commit();
  assert.equal(isVersionOnlyChange(f.base, f), false);
  assert.throws(() => isVersionOnlyChange('missing', f), /base commit SHA/);
  assert.throws(() => isVersionOnlyChange('a'.repeat(40), f));
});

test('the command reports the decision to GitHub and its job summary', async t => {
  const f = await fixture(t);
  f.commit();
  const output = path.join(f.cwd, 'output');
  const summary = path.join(f.cwd, 'summary');
  const script = fileURLToPath(new URL('../../../scripts/check-version-only.mjs', import.meta.url));
  execFileSync(process.execPath, [script, f.base], {
    cwd: f.cwd, stdio: 'pipe', env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
  });
  assert.equal(await readFile(output, 'utf8'), 'only=true\n');
  assert.match(await readFile(summary, 'utf8'), /Verified version-only changes/);
});
