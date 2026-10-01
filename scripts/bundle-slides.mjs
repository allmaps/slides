import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { captureBuildInfo } from '../packages/slides/src/build-info.ts';

export async function bundleSlides(root) {
  const require = createRequire(path.join(root, 'package.json'));
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const viewer = path.resolve(root, '../svelte-canvas-panel');
  // Keep all external runtime dependencies declared by the included packages.
  for (const name of ['iiif', 'static-render', 'svelte-canvas-panel']) {
    const internal = JSON.parse(await readFile(path.resolve(root, '..', name, 'package.json'), 'utf8'));
    for (const [dependency, version] of Object.entries(internal.dependencies)) {
      if (!version.startsWith('workspace:') && pkg.dependencies[dependency] !== version)
        throw new Error(`Declare ${dependency}@${version} in @allmaps/slides dependencies (required by ${internal.name})`);
    }
  }
  const result = spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['run', 'build'], { cwd: viewer, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Svelte component packaging failed');
  const { build } = await import(require.resolve('tsdown'));
  await build({ cwd: root, config: path.join(root, 'tsdown.config.ts') });
  await cp(path.join(viewer, 'dist'), path.join(root, 'dist/canvas-panel'), { recursive: true });

  const app = path.join(root, 'app');
  await rm(app, { recursive: true, force: true });
  await mkdir(app, { recursive: true });
  const source = path.resolve(root, '../../apps/slides');
  for (const name of ['src', 'static', 'vite.config.js', 'svelte.config.js', 'LICENSE.md'])
    await cp(path.join(source, name), path.join(app, name), { recursive: true });
  await writeFile(path.join(root, 'build-info.json'), JSON.stringify(await captureBuildInfo(root, false), null, 2) + '\n');
  console.log('Bundled @allmaps/slides, including IIIF, the renderer, Svelte components and application.');
}
