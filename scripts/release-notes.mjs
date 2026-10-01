import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const pkg = JSON.parse(await readFile(new URL('../packages/slides/package.json', import.meta.url), 'utf8'));
if (process.env.GITHUB_REF_NAME) assert.equal(process.env.GITHUB_REF_NAME, `${pkg.name}@${pkg.version}`);
const changelog = await readFile(new URL('../packages/slides/CHANGELOG.md', import.meta.url), 'utf8');
const marker = `## ${pkg.version}\n`;
assert.ok(changelog.includes(marker), `Missing changelog for ${pkg.version}`);
console.log(changelog.split(marker)[1].split(/^## /m)[0].trim());
