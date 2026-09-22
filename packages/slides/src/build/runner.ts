import { mkdir, symlink, readFile, lstat, unlink, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { exists, type RuntimeSlidesConfig } from "../content/config.ts";
import { atomicWrite } from "./files.ts";

/** Only small runner files are generated. App and content sources stay in place. */
export async function prepareRunner(config: RuntimeSlidesConfig, runner = path.join(config.workDir, "runner")) {
  await mkdir(runner, { recursive: true });
  const packageJson = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
  await atomicWrite(path.join(runner, "package.json"), JSON.stringify({ private: true, type: "module", dependencies: packageJson.dependencies }));
  await atomicWrite(path.join(runner, "vite.config.js"), `export { default } from ${JSON.stringify(pathToFileURL(path.join(config.appDir, "vite.config.js")).href)};\n`);
  await atomicWrite(path.join(runner, "svelte.config.js"), `import * as app from ${JSON.stringify(pathToFileURL(path.join(config.appDir, "svelte.config.js")).href)};\nexport default app.createSlidesConfig ? app.createSlidesConfig() : app.default;\n`);
  await atomicWrite(path.join(runner, "tsconfig.json"), JSON.stringify({
    extends: path.join(config.workDir, "svelte-kit", "tsconfig.json"),
    compilerOptions: { rewriteRelativeImportExtensions: true, allowJs: true, checkJs: true, esModuleInterop: true, skipLibCheck: true, strict: true, moduleResolution: "bundler", rootDirs: [runner, config.appDir, path.join(config.workDir, "svelte-kit/types")] },
    include: [path.join(runner, "src/**/*.ts"), path.join(runner, "src/**/*.js"), path.join(runner, "src/**/*.svelte"), path.join(config.workDir, "svelte-kit/**/*.d.ts")],
    exclude: [],
  }, null, 2));
  for (const name of ["src", "static"]) {
    const source = path.join(config.appDir, name), link = path.join(runner, name);
    if (await exists(source) && !await exists(link)) await symlink(source, link, "junction");
  }
  // Resolve actual dependencies: pnpm's package-local node_modules can exist
  // solely for a tool cache while dependencies live in its parent node_modules.
  // The prerender worker imports from SvelteKit's output, a sibling of runner.
  const modules = path.join(config.workDir, "node_modules");
  if ((await lstat(modules).catch(() => undefined))?.isSymbolicLink()) await unlink(modules);
  await mkdir(modules, { recursive: true });
  const require = createRequire(import.meta.url);
  for (const name of [packageJson.name, ...Object.keys(packageJson.dependencies)]) {
    let filename: string;
    try { filename = require.resolve(`${name}/package.json`); }
    catch { filename = require.resolve(name); }
    let directory = path.dirname(filename);
    while (true) {
      const manifest = path.join(directory, "package.json");
      if (await exists(manifest) && JSON.parse(await readFile(manifest, "utf8")).name === name) break;
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error(`Cannot locate installed dependency ${name}`);
      directory = parent;
    }
    const link = path.join(modules, name);
    await mkdir(path.dirname(link), { recursive: true });
    // Repoint cached runners after dependency updates.
    if ((await lstat(link).catch(() => undefined))?.isSymbolicLink()) await unlink(link);
    await symlink(directory, link, "junction");
  }
  const runnerModules = path.join(runner, "node_modules");
  await rm(runnerModules, { recursive: true, force: true });
  await symlink(modules, runnerModules, "junction");
  return runner;
}
