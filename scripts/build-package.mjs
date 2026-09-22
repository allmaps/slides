import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
async function compile(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) { await compile(filename); continue; }
    if (!/\.(ts|js)$/.test(filename) || filename.endsWith('.d.ts')) continue;
    const relative = path.relative(path.join(root, 'src'), filename).replace(/\.ts$/, '.js');
    const destination = path.join(dist, relative);
    const { outputText } = ts.transpileModule(await readFile(filename, 'utf8'), {
      fileName: filename,
      compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext, rewriteRelativeImportExtensions: true, verbatimModuleSyntax: true },
    });
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, outputText);
  }
}
await compile(path.join(root, 'src'));
const declarations = await mkdtemp(path.join(tmpdir(), 'slides-declarations-'));
try {
  // Workspace source exports are checked together; publish only this package's declarations.
  const result = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.json', '--declaration', '--emitDeclarationOnly', '--rewriteRelativeImportExtensions', '--rootDir', '../..', '--outDir', declarations], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Declaration generation failed: ${root}`);
  await cp(path.join(declarations, 'packages', path.basename(root), 'src'), dist, { recursive: true });
} finally { await rm(declarations, { recursive: true, force: true }); }
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
if (pkg.name === '@allmaps/slides') {
  const app = path.join(root, 'app');
  await rm(app, { recursive: true, force: true });
  await mkdir(app, { recursive: true });
  const source = path.resolve(root, '../../apps/slides');
  for (const name of ['src', 'static', 'vite.config.js', 'svelte.config.js'])
    await cp(path.join(source, name), path.join(app, name), { recursive: true });
}
console.log(`Built ${pkg.name}: JavaScript and declarations${pkg.name === '@allmaps/slides' ? ', including the application' : ''}.`);
