import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { test } from 'node:test';
import { parse } from 'yaml';
import { runInitCommand } from '../src/cli/commands/init.ts';
import { loadSlidesConfig } from '../src/content/config.ts';
import { loadContent } from '../src/content/index.ts';

const cli = fileURLToPath(new URL('../bin/slides.js', import.meta.url));
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'slides-init-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('init creates a valid independent project with the running package version and an escaped title', async t => {
  const root = await fixture(t);
  const project = path.join(root, 'nested', 'My Atlas');
  const title = 'Amsterdam: "maps" & images #1\nA second line';
  const output = execFileSync(process.execPath, [cli, 'init', project, '--title', title], {
    cwd: root, encoding: 'utf8', env: { ...process.env, npm_package_version: '99.0.0' },
  });
  assert.match(output, /pnpm install[\s\S]*pnpm dev/);
  assert.doesNotMatch(output, /Project title \[/, 'piped runs must not prompt');
  assert.deepEqual(parse(await readFile(path.join(project, 'slides.config.yml'), 'utf8')).protomaps, { key: '' });
  const manifest = JSON.parse(await readFile(path.join(project, 'package.json'), 'utf8'));
  assert.equal(manifest.name, 'my-atlas');
  assert.equal(manifest.private, true);
  assert.equal(manifest.devDependencies['@allmaps/slides'], pkg.version);
  assert.equal(manifest.scripts.dev, 'slides dev .');
  const workspace = parse(await readFile(path.join(project, 'pnpm-workspace.yaml'), 'utf8'));
  assert.deepEqual(workspace.packages, []);
  assert.ok(workspace.onlyBuiltDependencies.includes('sharp'));
  const content = await loadContent(await loadSlidesConfig({ content: project, cwd: project }));
  assert.equal(content.project.title, title);
  assert.equal(content.slideCount, 1);
  assert.equal(content.config.slidesConfig.map, undefined);
  assert.equal(content.config.protomapsKey, '');
  assert.match(execFileSync(process.execPath, [cli, 'validate', '.'], { cwd: project, encoding: 'utf8' }), /1 slides/);
  assert.equal((await readdir(project)).includes('node_modules'), false, 'init must not install dependencies');
});

// Exercise the real CLI and readline with controllable streams. Marking the
// pipes as a terminal avoids depending on a platform-specific PTY test library.
async function interactive(t, root, args, answers) {
  const terminal = 'data:text/javascript,' + encodeURIComponent(`
    Object.defineProperty(process.stdin, 'isTTY', { value: true });
    Object.defineProperty(process.stdout, 'isTTY', { value: true });
  `);
  const child = spawn(process.execPath, ['--import', terminal, cli, ...args], {
    cwd: root, stdio: ['pipe', 'pipe', 'pipe'],
  });
  t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
  let stdout = '', stderr = '', answered = 0;
  child.stdout.on('data', chunk => {
    stdout += chunk;
    const [prompt, answer] = answers[answered] ?? [];
    if (prompt && stripVTControlCharacters(stdout).includes(prompt)) {
      answered++;
      if (answer === null) child.stdin.end();
      else child.stdin.write(answer);
    }
  });
  child.stderr.on('data', chunk => stderr += chunk);
  const code = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  assert.equal(answered, answers.length, stdout + stderr);
  return { code, stdout: stripVTControlCharacters(stdout), stderr };
}

test('interactive init saves both answers and explains that settings can change later', { timeout: 10_000 }, async t => {
  const root = await fixture(t);
  const result = await interactive(t, root, ['init'], [
    ['Project title [My narrative map]: ', '  Amsterdam: maps & images  \n'],
    ['Protomaps API key (optional; Enter for no basemap): ', '  demo-key  \n'],
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /change the title and Protomaps key later in slides.config.yml/);
  assert.match(result.stdout, /https:\/\/protomaps.com\/api/);
  const config = parse(await readFile(path.join(root, 'slides.config.yml'), 'utf8'));
  assert.equal(config.title, 'Amsterdam: maps & images');
  assert.deepEqual(config.protomaps, { key: 'demo-key' });
});

test('Enter accepts the title default and writes an empty key', { timeout: 10_000 }, async t => {
  const root = await fixture(t);
  const result = await interactive(t, root, ['create'], [
    ['Project title [My narrative map]: ', '\n'],
    ['Protomaps API key (optional; Enter for no basemap): ', '\n'],
  ]);
  assert.equal(result.code, 0, result.stderr);
  const config = parse(await readFile(path.join(root, 'slides.config.yml'), 'utf8'));
  assert.equal(config.title, 'My narrative map');
  assert.deepEqual(config.protomaps, { key: '' });
});

test('explicit options skip their prompts and --yes uses defaults even in a terminal', { timeout: 20_000 }, async t => {
  const root = await fixture(t);
  const cases = [
    { args: ['--yes'], answers: [], title: 'My narrative map', key: '' },
    { args: ['--yes', '--title', 'Fixed title', '--protomaps-key', 'fixed-key'], answers: [], title: 'Fixed title', key: 'fixed-key' },
    { args: ['--title', 'Fixed title', '--protomaps-key', ''], answers: [], title: 'Fixed title', key: '' },
    { args: ['--title', 'Fixed title'], answers: [['Protomaps API key (optional; Enter for no basemap): ', '\n']], title: 'Fixed title', key: '' },
    { args: ['--protomaps-key', 'fixed-key'], answers: [['Project title [My narrative map]: ', '\n']], title: 'My narrative map', key: 'fixed-key' },
  ];
  for (const [index, { args, answers, title, key }] of cases.entries()) {
    const project = path.join(root, String(index));
    const result = await interactive(t, root, ['init', project, ...args], answers);
    assert.equal(result.code, 0, result.stderr);
    if (args.includes('--yes') || args.includes('--title')) assert.doesNotMatch(result.stdout, /Project title \[/);
    if (args.includes('--yes') || args.includes('--protomaps-key')) assert.doesNotMatch(result.stdout, /Protomaps API key \(optional/);
    const config = parse(await readFile(path.join(project, 'slides.config.yml'), 'utf8'));
    assert.equal(config.title, title);
    assert.deepEqual(config.protomaps, { key });
  }
});

test('cancelling or closing a prompt leaves no partial project', { timeout: 10_000 }, async t => {
  const root = await fixture(t);
  for (const [index, cancel] of ['\u0003', null].entries()) {
    const project = path.join(root, String(index));
    const result = await interactive(t, root, ['init', project], [
      ['Project title [My narrative map]: ', 'My unfinished project\n'],
      ['Protomaps API key (optional; Enter for no basemap): ', cancel],
    ]);
    assert.equal(result.code, 130, result.stderr);
    assert.match(result.stdout, /creation cancelled/);
    assert.deepEqual(await readdir(root), []);
  }
});

test('create aliases init and defaults to the current folder, preserving unrelated files', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, '.git'));
  await writeFile(path.join(root, 'notes.txt'), 'Keep these notes.');
  execFileSync(process.execPath, [cli, 'create'], { cwd: root });
  assert.equal(await readFile(path.join(root, 'notes.txt'), 'utf8'), 'Keep these notes.');
  assert.equal((await loadContent(await loadSlidesConfig({ content: root }))).slideCount, 1);
  const welcome = await readFile(path.join(root, 'chapters/01-welcome.md'), 'utf8');
  const again = spawnSync(process.execPath, [cli, 'init'], { cwd: root, encoding: 'utf8' });
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already contains/);
  assert.equal(await readFile(path.join(root, 'chapters/01-welcome.md'), 'utf8'), welcome);
});

test('conflicting starter files and alternative configs are detected before any writes', async t => {
  const root = await fixture(t);
  for (const name of ['package.json', 'README.md', '.gitignore', 'pnpm-workspace.yaml',
    'slides.config.yml', 'slides.config.yaml', 'slides.config.json', 'chapters']) {
    const project = path.join(root, name);
    await mkdir(project);
    await writeFile(path.join(project, name), 'Existing content');
    await assert.rejects(runInitCommand(project), /already contains/);
    assert.deepEqual(await readdir(project), [name]);
    assert.equal(await readFile(path.join(project, name), 'utf8'), 'Existing content');
  }
});

test('init refuses existing chapter directories and dangling symlinks without following them', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'chapters'));
  await writeFile(path.join(root, 'chapters/existing.md'), 'Keep this slide.');
  await assert.rejects(runInitCommand(root), /already contains chapters/);
  assert.deepEqual(await readdir(root), ['chapters']);
  assert.equal(await readFile(path.join(root, 'chapters/existing.md'), 'utf8'), 'Keep this slide.');
  const linked = path.join(root, 'linked');
  await mkdir(linked);
  const target = path.join(root, 'missing-config');
  await symlink(target, path.join(linked, 'slides.config.yml'));
  await assert.rejects(runInitCommand(linked), /already contains slides.config.yml/);
  await assert.rejects(readFile(target), { code: 'ENOENT' });
  assert.deepEqual(await readdir(linked), ['slides.config.yml']);
});

test('invalid destinations and empty titles fail without changing the filesystem', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'file');
  await writeFile(file, 'Keep this file.');
  await assert.rejects(runInitCommand(file), /must be a directory/);
  assert.equal(await readFile(file, 'utf8'), 'Keep this file.');
  const project = path.join(root, 'empty-title');
  await assert.rejects(runInitCommand(project, { title: '  ' }), /title must not be empty/);
  assert.deepEqual(await readdir(root), ['file']);
});
