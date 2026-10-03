import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { checkRelease } from './check-release.mjs';

// The build stamp works for both local and CI publications; tarball publications
// do not necessarily have npm's optional gitHead metadata.
export async function publishedBuildInfo(name, version, fetchFn = fetch) {
  const metadata = await fetchFn(`https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (metadata.status === 404) return undefined;
  if (!metadata.ok) throw new Error(`npm registry returned HTTP ${metadata.status}`);
  const pkg = await metadata.json();
  assert.equal(pkg.name, name);
  assert.equal(pkg.version, version);
  const url = new URL(pkg.dist.tarball);
  assert.equal(url.origin, 'https://registry.npmjs.org');
  const response = await fetchFn(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`npm tarball returned HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(pkg.dist.integrity, `sha512-${createHash('sha512').update(bytes).digest('base64')}`, 'Published tarball integrity mismatch');
  return JSON.parse(execFileSync('tar', ['-xzOf', '-', 'package/build-info.json'], {
    input: bytes, encoding: 'utf8', maxBuffer: 1024 * 1024,
  }));
}

export async function prepareNpmRelease({
  root = fileURLToPath(new URL('../', import.meta.url)),
  env = process.env,
  fetchFn = fetch,
} = {}) {
  assert.equal(env.GITHUB_REF, 'refs/heads/main', 'npm publication must run on main');
  const git = (...args) => execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  const pkg = JSON.parse(await readFile(path.join(root, 'packages/slides/package.json'), 'utf8'));
  assert.equal(pkg.name, '@allmaps/slides');
  if (env.GITHUB_EVENT_NAME === 'push') {
    assert.match(env.RELEASE_BEFORE ?? '', /^[a-f0-9]{40,64}$/);
    const previous = JSON.parse(git('show', `${env.RELEASE_BEFORE}:packages/slides/package.json`));
    if (previous.version === pkg.version) return { release: false };
  } else {
    assert.equal(env.GITHUB_EVENT_NAME, 'workflow_dispatch');
  }
  const { info, npmTag } = await checkRelease(root);
  assert.equal(info.revision, env.GITHUB_SHA, 'Checkout must match the workflow commit');
  const tag = `${info.name}@${info.version}`;
  let taggedRevision;
  try {
    taggedRevision = git('rev-parse', '--verify', `refs/tags/${tag}^{commit}`);
  } catch (error) {
    if (error.status !== 128) throw error;
  }
  if (taggedRevision) assert.equal(taggedRevision, info.revision, 'Existing release tag points to a different commit');
  const published = await publishedBuildInfo(info.name, info.version, fetchFn);
  if (published) {
    for (const key of ['schemaVersion', 'name', 'version', 'repositoryUrl', 'revision', 'sourceState', 'development']) {
      assert.equal(published[key], info[key], `Published package has different ${key}; rerun the original release commit`);
    }
  }
  return { release: true, published: Boolean(published), tag, version: info.version, npmTag };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await prepareNpmRelease();
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''));
  }
  const message = !result.release ? 'Package version unchanged; no release needed.'
    : result.published ? `${result.tag} is already on npm from this commit; finishing the GitHub release.`
    : `Publishing ${result.tag} to npm's ${result.npmTag} channel.`;
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
