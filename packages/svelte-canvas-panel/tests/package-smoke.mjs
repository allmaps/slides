import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = await mkdtemp(join(tmpdir(), 'svelte-canvas-panel-consumer-'));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const run = (args, cwd = directory) => execFileSync(pnpm, args, { cwd, stdio: 'inherit' });
try {
  run(['pack', '--pack-destination', directory], root);
  const tarball = (await readdir(directory)).find(file => file.endsWith('.tgz'));
  assert.ok(tarball, 'pnpm pack produced a release archive');
  await cp(join(root, 'tests/consumer'), directory, { recursive: true });
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  await writeFile(join(directory, 'package.json'), JSON.stringify({
    name: 'iiif-package-consumer', private: true, type: 'module',
    dependencies: { [pkg.name]: `file:./${tarball}`, svelte: pkg.devDependencies.svelte },
    devDependencies: Object.fromEntries(['@sveltejs/vite-plugin-svelte', '@types/node', 'svelte-check', 'typescript', 'vite'].map(name => [name, pkg.devDependencies[name]]))
  }, null, 2));
  run(['install', '--ignore-workspace']);
  const installed = JSON.parse(await readFile(join(directory, 'node_modules', pkg.name, 'package.json'), 'utf8'));
  assert.equal(installed.exports['.'].svelte, './dist/index.js');
  assert.equal(installed.exports['.'].types, './dist/index.d.ts');
  run(['exec', 'svelte-check', '--tsconfig', './tsconfig.json']);
  run(['exec', 'vite', 'build']);
  run(['exec', 'vite', 'build', '--ssr', 'ssr.ts']);
  execFileSync(process.execPath, ['dist-ssr/ssr.js'], { cwd: directory, stdio: 'inherit' });
  console.log(`Packed consumer passed: ${directory}`);
} finally {
  if (process.env.KEEP_VIEWER_CONSUMER !== '1') await rm(directory, { recursive: true, force: true });
  else console.log(`Kept consumer at ${directory}`);
}
