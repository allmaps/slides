import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parse } from 'yaml';
import { checkRelease } from '../../../scripts/check-release.mjs';
import { prepareNpmRelease, publishedBuildInfo } from '../../../scripts/prepare-npm-release.mjs';
import { syncNpmTags } from '../../../scripts/sync-npm-tags.mjs';

const name = '@allmaps/slides';
const version = '0.1.0-beta.2';
const noNetwork = () => { throw new Error('Unexpected registry request'); };

test('version workflow ignores consumed beta notes but allows new changesets and beta exit', async t => {
  const workflow = parse(await readFile(new URL('../../../.github/workflows/version.yml', import.meta.url), 'utf8'));
  const check = workflow.jobs.version.steps.find(step => step.id === 'changes').run;
  for (const { mode, pending, expected } of [
    { mode: 'pre', pending: false, expected: false },
    { mode: 'pre', pending: true, expected: true },
    { mode: 'exit', pending: false, expected: true },
    { mode: undefined, pending: false, expected: false },
    { mode: undefined, pending: true, expected: true },
  ]) {
    const root = await mkdtemp(path.join(tmpdir(), 'slides-version-workflow-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(root, '.changeset/pre'), { recursive: true });
    await writeFile(path.join(root, '.changeset/README.md'), 'Release instructions');
    await writeFile(path.join(root, '.changeset/config.json'), '{}');
    await writeFile(path.join(root, '.changeset/pre/shipped.md'), '---\n"@allmaps/slides": patch\n---\nAlready released.\n');
    if (mode) await writeFile(path.join(root, '.changeset/pre.json'), JSON.stringify({ mode, tag: 'beta' }));
    if (pending) await writeFile(path.join(root, '.changeset/new.md'), '---\n"@allmaps/slides": patch\n---\nNew fix.\n');
    const output = path.join(root, 'output');
    const summary = path.join(root, 'summary');
    execFileSync('bash', ['-e', '-c', check], {
      cwd: root, stdio: 'pipe', env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
    });
    assert.equal(await readFile(output, 'utf8'), `needed=${expected}\n`, JSON.stringify({ mode, pending }));
    if (!expected) assert.match(await readFile(summary, 'utf8'), /no version PR needed/);
  }
});

async function fixture(t, nextVersion = version) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'slides-release-')));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'Release test');
  git('config', 'user.email', 'release@example.org');
  await mkdir(path.join(root, 'packages/slides'), { recursive: true });
  await mkdir(path.join(root, '.changeset'));
  const writeVersion = async value => {
    await writeFile(path.join(root, 'packages/slides/package.json'), JSON.stringify({
      name, version: value, repository: { url: 'https://github.com/allmaps/slides.git' },
    }));
    await writeFile(path.join(root, 'packages/slides/CHANGELOG.md'), `# ${name}\n\n## ${value}\n\nRelease notes.\n`);
    if (value.includes('-beta.')) await writeFile(path.join(root, '.changeset/pre.json'), JSON.stringify({ mode: 'pre', tag: 'beta' }));
    else await rm(path.join(root, '.changeset/pre.json'), { force: true });
  };
  const commit = () => { git('add', '.'); git('commit', '-m', 'Fixture'); return git('rev-parse', 'HEAD'); };
  await writeVersion('0.1.0-beta.1');
  const before = commit();
  await writeVersion(nextVersion);
  const revision = nextVersion === '0.1.0-beta.1' ? before : commit();
  const env = { GITHUB_REF: 'refs/heads/main', GITHUB_SHA: revision, GITHUB_EVENT_NAME: 'push', RELEASE_BEFORE: before };
  return { root, git, env, before, revision, commit };
}

async function publishedFixture(t, info, { corrupt = false, tarStatus = 200 } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-published-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'package'));
  await writeFile(path.join(root, 'package/build-info.json'), JSON.stringify(info));
  const tarball = execFileSync('tar', ['-czf', '-', '-C', root, 'package/build-info.json']);
  const url = 'https://registry.npmjs.org/@allmaps/slides/-/slides.tgz';
  return async requested => {
    if (String(requested) === url) return new Response(tarball, { status: tarStatus });
    assert.equal(String(requested), `https://registry.npmjs.org/${encodeURIComponent(info.name)}/${info.version}`);
    return Response.json({ name: info.name, version: info.version, dist: {
      tarball: url, integrity: corrupt ? 'sha512-wrong' : `sha512-${createHash('sha512').update(tarball).digest('base64')}`,
    } });
  };
}

test('ordinary main pushes skip publication even with pending changesets', async t => {
  const f = await fixture(t, '0.1.0-beta.1');
  await writeFile(path.join(f.root, '.changeset/feature.md'), 'Pending release');
  f.env.GITHUB_SHA = f.commit();
  assert.deepEqual(await prepareNpmRelease({ ...f, fetchFn: noNetwork }), { release: false });
});

test('version bumps publish beta and stable versions to their respective channels', async t => {
  for (const [nextVersion, npmTag] of [[version, 'beta'], ['0.1.0', 'latest']]) {
    const f = await fixture(t, nextVersion);
    assert.deepEqual(await prepareNpmRelease({ ...f, fetchFn: async () => new Response(null, { status: 404 }) }), {
      release: true, published: false, tag: `${name}@${nextVersion}`, version: nextVersion, npmTag,
    });
  }
});

test('publication requires main, the event commit, clean source, and consumed changesets', async t => {
  const f = await fixture(t);
  await assert.rejects(prepareNpmRelease({ ...f, env: { ...f.env, GITHUB_REF: 'refs/heads/develop' }, fetchFn: noNetwork }), /must run on main/);
  await assert.rejects(prepareNpmRelease({ ...f, env: { ...f.env, GITHUB_SHA: f.before }, fetchFn: noNetwork }), /workflow commit/);
  await writeFile(path.join(f.root, '.changeset/feature.md'), 'Pending release');
  await assert.rejects(prepareNpmRelease({ ...f, fetchFn: noNetwork }), /Commit all software changes/);
  f.env.GITHUB_SHA = f.commit();
  await assert.rejects(prepareNpmRelease({ ...f, fetchFn: noNetwork }), /pending changes/);
});

test('manual retry recognizes the published build without needing npm gitHead metadata', async t => {
  const f = await fixture(t);
  const { info } = await checkRelease(f.root);
  const fetchFn = await publishedFixture(t, info);
  const result = await prepareNpmRelease({ ...f, env: { ...f.env, GITHUB_EVENT_NAME: 'workflow_dispatch' }, fetchFn });
  assert.equal(result.release, true);
  assert.equal(result.published, true);
  f.git('tag', `${name}@${version}`);
  assert.equal((await prepareNpmRelease({ ...f, fetchFn })).published, true);
});

test('retries refuse an existing tag or npm version from a different commit', async t => {
  const f = await fixture(t);
  const { info } = await checkRelease(f.root);
  const fetchFn = await publishedFixture(t, { ...info, revision: f.before });
  await assert.rejects(prepareNpmRelease({ ...f, fetchFn }), /different revision/);
  f.git('tag', `${name}@${version}`, f.before);
  await assert.rejects(prepareNpmRelease({ ...f, fetchFn: noNetwork }), /tag points to a different commit/);
});

test('registry errors, missing tarballs, and corrupt packages cannot be mistaken for unpublished versions', async t => {
  await assert.rejects(publishedBuildInfo(name, version, async () => new Response(null, { status: 503 })), /HTTP 503/);
  const f = await fixture(t);
  const { info } = await checkRelease(f.root);
  await assert.rejects(publishedBuildInfo(name, version, await publishedFixture(t, info, { corrupt: true })), /integrity mismatch/);
  await assert.rejects(publishedBuildInfo(name, version, await publishedFixture(t, info, { tarStatus: 404 })), /tarball returned HTTP 404/);
});

test('beta publication advances latest without changing the beta alias', async () => {
  for (const latest of [undefined, '0.1.0-beta.1', '0.0.9-beta.99']) {
    const commands = [];
    const result = await syncNpmTags({ name, version }, {
      fetchFn: async url => {
        assert.equal(url, `https://registry.npmjs.org/-/package/${encodeURIComponent(name)}/dist-tags`);
        return Response.json({ beta: version, ...(latest ? { latest } : {}) });
      },
      run: (...args) => commands.push(args),
    });
    assert.equal(commands.length, 1);
    assert.deepEqual(commands[0][1], ['dist-tag', 'add', `${name}@${version}`, 'latest', '--registry=https://registry.npmjs.org']);
    assert.match(result, /latest and beta now point/);
  }
});

test('tag repair preserves stable, current and newer defaults', async () => {
  const noWrite = () => assert.fail('Must not change npm tags');
  for (const latest of ['0.1.0', '0.0.1', version, '0.1.0-beta.10', '0.2.0-beta.1', '1.0.0-rc.1']) {
    await syncNpmTags({ name, version }, {
      fetchFn: async () => Response.json({ beta: version, latest }), run: noWrite,
    });
  }
  await syncNpmTags({ name, version: '0.1.0' }, { fetchFn: noNetwork, run: noWrite });
  await assert.rejects(syncNpmTags({ name, version }, {
    fetchFn: async () => Response.json({ beta: '0.1.0-beta.3', latest: '0.1.0-beta.1' }), run: noWrite,
  }), /current published beta/);
});

test('tag updates refuse unpublished betas and registry failures', async () => {
  const noWrite = () => assert.fail('Must not change npm tags');
  await assert.rejects(syncNpmTags({ name, version }, {
    fetchFn: async () => Response.json({ latest: '0.1.0-beta.1' }), run: noWrite,
  }), /current published beta/);
  await assert.rejects(syncNpmTags({ name, version }, {
    fetchFn: async () => new Response(null, { status: 503 }), run: noWrite,
  }), /HTTP 503/);
});
