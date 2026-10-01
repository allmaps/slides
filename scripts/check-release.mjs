import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { captureBuildInfo } from '../packages/slides/src/build-info.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
export const info = await captureBuildInfo(path.join(root, 'packages/slides'), false);
assert.equal(info.sourceState, 'clean', 'Commit all software changes before publishing; content changes are excluded.');
assert.ok(info.sourceUrl, 'Publishing requires a Git revision and a public GitHub repository in package.json.');
const pre = await readFile(path.join(root, '.changeset/pre.json'), 'utf8').then(JSON.parse).catch(error => {
  if (error.code === 'ENOENT') return undefined;
  throw error;
});
const beta = /^\d+\.\d+\.\d+-beta\.\d+$/.test(info.version);
assert.ok(beta || /^\d+\.\d+\.\d+$/.test(info.version), 'Use a regular version or a beta prerelease.');
if (beta) assert.ok(pre?.mode === 'pre' && pre.tag === 'beta', 'Beta publication requires Changesets beta mode.');
else assert.equal(pre, undefined, 'Finish Changesets prerelease exit and versioning before publishing a regular release.');
const pending = (await readdir(path.join(root, '.changeset'))).filter(name => name.endsWith('.md') && name !== 'README.md');
assert.deepEqual(pending, [], 'Run pnpm release:version and commit the result before publishing pending changes.');
const changelog = await readFile(path.join(root, 'packages/slides/CHANGELOG.md'), 'utf8');
assert.ok(changelog.includes(`## ${info.version}\n`), 'The current version needs a changelog entry.');
export const npmTag = beta ? 'beta' : 'latest';
console.log(`${info.name}@${info.version}\nSource: ${info.sourceUrl}\nnpm tag: ${npmTag}`);
