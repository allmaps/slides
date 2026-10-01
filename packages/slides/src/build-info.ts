import { execFileSync } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { packageRoot } from "./package.ts";

export type BuildInfo = {
  schemaVersion: 1;
  name: string;
  version: string;
  repositoryUrl?: string;
  revision?: string;
  sourceState: "clean" | "modified" | "unknown";
  development: boolean;
  sourceUrl?: string;
  releaseNotesUrl?: string;
};

export type SiteBuildInfo = BuildInfo & {
  customApp: boolean;
  applicationSourceUrl?: string;
};

async function manifest(root: string) {
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const url = (typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url)?.replace(/^git\+/, "").replace(/\.git$/, "");
  // Only public repository identifiers enter the browser bundle, never remotes,
  // credentials, absolute paths or the content project's environment variables.
  const repositoryUrl = typeof url === "string" && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(url) ? url : undefined;
  return { name: String(pkg.name), version: String(pkg.version), repositoryUrl };
}

function links(info: BuildInfo): BuildInfo {
  if (info.repositoryUrl && info.revision && info.sourceState === "clean") {
    info.sourceUrl = `${info.repositoryUrl}/tree/${info.revision}`;
    if (!info.development) info.releaseNotesUrl = `${info.repositoryUrl}/releases/tag/${encodeURIComponent(`${info.name}@${info.version}`)}`;
  }
  return info;
}

/** Called only in the software checkout, including by the package bundler. */
export async function captureBuildInfo(root = packageRoot, development = true): Promise<BuildInfo> {
  const info: BuildInfo = { schemaVersion: 1, ...await manifest(root), sourceState: "unknown", development };
  const repository = path.resolve(root, "../..");
  const git = (...args: string[]) => execFileSync("git", ["--no-optional-locks", "-C", repository, ...args],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 }).trim();
  try {
    // Never walk up into a consumer's Git repository when metadata is missing.
    if (await realpath(git("rev-parse", "--show-toplevel")) !== await realpath(repository)) return info;
    const revision = git("rev-parse", "HEAD");
    if (!/^[a-f0-9]{40,64}$/.test(revision)) return info;
    info.revision = revision;
    info.sourceState = git("status", "--porcelain", "--untracked-files=all", "--ignore-submodules=all", "--", ".", ":(exclude)content")
      ? "modified" : "clean";
  } catch { /* Source archives and environments without Git have no revision. */ }
  return links(info);
}

/** Installed packages use the stamp made at pack time, never consumer Git state. */
export async function getBuildInfo(root = packageRoot): Promise<BuildInfo> {
  const pkg = await manifest(root);
  if (await stat(path.join(root, "src")).then(s => s.isDirectory()).catch(() => false)) return captureBuildInfo(root);
  const unknown: BuildInfo = { schemaVersion: 1, ...pkg, sourceState: "unknown", development: false };
  try {
    const stamp = JSON.parse(await readFile(path.join(root, "build-info.json"), "utf8"));
    if (stamp.schemaVersion !== 1 || stamp.name !== pkg.name || stamp.version !== pkg.version || stamp.repositoryUrl !== pkg.repositoryUrl) return unknown;
    if (!/^[a-f0-9]{40,64}$/.test(stamp.revision) || !["clean", "modified"].includes(stamp.sourceState)) return unknown;
    return links({ ...unknown, revision: stamp.revision, sourceState: stamp.sourceState });
  } catch { return unknown; }
}

export function siteBuildInfo(info: BuildInfo, app?: { directory?: string; sourceUrl?: string }): SiteBuildInfo {
  const customApp = Boolean(app?.directory);
  return { ...info, customApp, applicationSourceUrl: customApp ? app?.sourceUrl : info.sourceUrl };
}
