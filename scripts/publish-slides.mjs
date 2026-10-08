import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkRelease } from './check-release.mjs';
import { syncNpmTags } from './sync-npm-tags.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const { info, npmTag } = await checkRelease(cwd);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
// Publish to the release channel first; syncNpmTags also advances latest during beta.
execFileSync(pnpm, ['--filter', info.name, 'publish', '--access', 'public', '--tag', npmTag, '--no-git-checks'], { cwd, stdio: 'inherit' });
await syncNpmTags(info);
execFileSync(pnpm, ['exec', 'changeset', 'git-tag'], { cwd, stdio: 'inherit' });
