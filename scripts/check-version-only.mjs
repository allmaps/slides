import { execFileSync } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const manifest = 'packages/slides/package.json';
const versionPattern = /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/;

// Compare the checked-out PR merge with its base, not just its branch name or
// last commit. Dependency, lockfile, code and workflow edits must run the tests.
export function isVersionOnlyChange(base, { cwd = process.cwd() } = {}) {
  if (!/^[a-f0-9]{40,64}$/.test(base ?? '')) throw new Error('Expected the PR base commit SHA');
  const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const entries = git('diff', '--raw', '--no-renames', '--ignore-submodules=none', '-z', base, 'HEAD', '--').split('\0');
  let versionChanged = false;
  for (let i = 0; i < entries.length - 1; i += 2) {
    const [beforeMode, afterMode, , , status] = entries[i].slice(1).split(' ');
    const file = entries[i + 1];
    // Release metadata consists of ordinary files, never symlinks or submodules.
    if (![beforeMode, afterMode].every(mode => mode === '100644' || mode === '000000')) return false;
    if (!['A', 'M', 'D'].includes(status)) return false;
    if (file === manifest) {
      if (status !== 'M') return false;
      versionChanged = true;
    } else if (file === 'packages/slides/CHANGELOG.md') {
      if (status === 'D') return false;
    } else if (file !== '.changeset/pre.json' && !/^\.changeset\/(?:pre\/)?[^/]+\.md$/.test(file)) {
      return false;
    }
  }
  if (!versionChanged) return false;

  let before, after;
  // A malformed manifest needs the normal checks, not a release shortcut.
  const beforeText = git('show', `${base}:${manifest}`);
  const afterText = git('show', `HEAD:${manifest}`);
  try {
    before = JSON.parse(beforeText);
    after = JSON.parse(afterText);
  } catch {
    return false;
  }
  if (!before || !after || typeof before.version !== 'string' || typeof after.version !== 'string') return false;
  const { version: beforeVersion, ...beforePackage } = before;
  const { version: afterVersion, ...afterPackage } = after;
  return beforePackage.name === '@allmaps/slides'
    && versionPattern.test(afterVersion)
    && beforeVersion !== afterVersion
    && isDeepStrictEqual(beforePackage, afterPackage);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const only = isVersionOnlyChange(process.argv[2]);
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `only=${only}\n`);
  const message = only
    ? 'Verified version-only changes; the expensive tests were not needed.'
    : 'Changes are not version-only; running the normal checks.';
  console.log(message);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
}
