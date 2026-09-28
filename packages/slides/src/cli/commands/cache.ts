import { realpath, rm } from "node:fs/promises";
import path from "node:path";
import { loadSlidesConfig, type LoadSlidesConfigOptions } from "../../content/config.ts";

// Resolve existing ancestors as well, so a custom cache symlink cannot make a
// seemingly harmless path point at the content or application source.
async function canonical(filename: string): Promise<string> {
  try { return await realpath(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return path.join(await canonical(path.dirname(filename)), path.basename(filename));
  }
}
const contains = (parent: string, child: string) => parent === child || child.startsWith(parent + path.sep);

export async function runCachePurgeCommand(options: LoadSlidesConfigOptions & { all?: boolean; dryRun?: boolean } = {}) {
  const config = await loadSlidesConfig(options);
  const targets = [options.all ? path.join(config.cacheDir, "slides") : config.projectDir];
  if (config.cacheDir.split(path.sep).includes("node_modules")) {
    const runners = path.join(config.options.cwd, ".slides", "projects");
    targets.push(options.all ? runners : path.join(runners, config.projectKey));
  }
  const protectedPaths = await Promise.all([
    config.options.cwd, config.sourceContentDir, config.appDir, config.outDir,
  ].map(canonical));
  // Validate every target before deleting any of them.
  for (const target of targets) {
    const resolved = await canonical(target);
    if (protectedPaths.some(protectedPath => contains(resolved, protectedPath))) {
      throw new Error(`Refusing to purge a cache that contains source or build output: ${target}`);
    }
  }
  for (const target of targets) {
    console.log(`${options.dryRun ? "Would remove" : "Removing"} ${target}`);
    if (!options.dryRun) await rm(target, { recursive: true, force: true });
  }
  if (!options.all) console.log("Shared image, thumbnail and download caches retained. Use --all to purge those too.");
  return targets;
}
