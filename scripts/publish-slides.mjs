import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { info, npmTag } from './check-release.mjs';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
// Changesets can prefer `latest` before a package has any stable releases.
// Specify the channel ourselves; the imported check verifies the software tree.
execFileSync(pnpm, ['--filter', info.name, 'publish', '--access', 'public', '--tag', npmTag, '--no-git-checks'], { cwd, stdio: 'inherit' });
execFileSync(pnpm, ['exec', 'changeset', 'git-tag'], { cwd, stdio: 'inherit' });
