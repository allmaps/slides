import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const betaParts = version => /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/.exec(version)?.slice(1).map(Number);

/** Keep the default install current while the package has only beta releases. */
export async function syncNpmTags({ name, version }, {
  fetchFn = fetch,
  run = execFileSync,
  dryRun = false,
} = {}) {
  assert.equal(name, '@allmaps/slides');
  const target = betaParts(version);
  if (!target) {
    assert.match(version, /^\d+\.\d+\.\d+$/);
    return 'Stable publications already update latest.';
  }
  const response = await fetchFn(`https://registry.npmjs.org/-/package/${encodeURIComponent(name)}/dist-tags`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`npm dist-tags returned HTTP ${response.status}`);
  const tags = await response.json();
  assert.equal(tags.beta, version, 'Only the current published beta can be promoted to latest.');
  if (tags.latest === version) return `latest already points to ${version}.`;
  if (tags.latest) {
    const current = betaParts(tags.latest);
    // Once latest points to a stable release (or another prerelease channel),
    // beta publication must leave that default alone.
    if (!current) return `Keeping latest at ${tags.latest}; beta remains opt-in.`;
    const difference = target.findIndex((part, index) => part !== current[index]);
    if (difference < 0 || target[difference] < current[difference])
      return `Keeping newer latest ${tags.latest}.`;
  }
  if (dryRun) return `Would set latest to ${version}, retaining beta.`;
  run(process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['dist-tag', 'add', `${name}@${version}`, 'latest', '--registry=https://registry.npmjs.org'],
    { stdio: 'inherit' });
  return `latest and beta now point to ${version}.`;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const pkg = JSON.parse(await readFile(new URL('../packages/slides/package.json', import.meta.url), 'utf8'));
  console.log(await syncNpmTags(pkg, { dryRun: process.argv.includes('--dry-run') }));
}
