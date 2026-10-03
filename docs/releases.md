# Publish versions and GitHub releases

Only `@allmaps/slides` goes to npm. The application and bundled helpers share
its version in [`packages/slides/package.json`](../packages/slides/package.json).
GitHub Actions publishes the package and creates its Git tag and GitHub release.
Content repositories choose when to upgrade and redeploy their websites.

## Publish the next version

1. Make and test the software change. Run `pnpm changeset`, select
   `@allmaps/slides`, choose the change type and describe the user-visible change.
   Commit the changeset with the code and merge it into `main`. Multiple pending
   changesets are collected into one release.
2. **Prepare release** opens or updates a version PR with the new version,
   changelog and lockfile. During beta, the next version after `0.1.0-beta.1` is
   `0.1.0-beta.2`. Review the PR, let its checks pass, and merge it.
3. **Publish release** detects the version change on `main`, checks the release,
   builds and packs the software, and publishes it to npm. Beta versions update
   `beta` and also `latest` while the default version is still a beta. Once
   `latest` points to a stable release, later betas leave it unchanged. Stable
   versions update `latest`. It then creates and pushes
   an annotated tag such as `@allmaps/slides@0.1.0-beta.2` and creates the matching
   GitHub release from the changelog. Beta versions are GitHub prereleases.
   No local publish command or manual tagging is needed.
4. Upgrade each content repository that should use the new version:

   ```sh
   pnpm add -D -E @allmaps/slides@0.1.0-beta.2
   pnpm validate
   pnpm build
   ```

   Commit its `package.json` and `pnpm-lock.yaml` and push to deploy the website.
   A Slides release does not automatically upgrade existing presentations.

An ordinary change to the package manifest without a version change does not
publish anything. Pending changesets alone do not publish anything either:
they prepare the version PR. A release requires a clean software commit,
consumed changesets and a changelog entry matching the version.

[Software checks](development.md#checks) cover the package and application.
Content changes belong in their own repositories and need no Slides changeset.
Local content edits do not block `pnpm release:check`.

## npm trusted publisher

The package's npm settings must authorize this GitHub trusted publisher:

| Setting | Value |
| --- | --- |
| Organization | `allmaps` |
| Repository | `slides` |
| Workflow filename | `release.yml` |
| Environment name | `npm` |
| Allowed actions | Enable **npm publish** and **npm dist-tag**. |

The publishing job uses the GitHub environment named `npm`. Under repository
**Settings → Environments → npm**, restrict deployment branches to `main`.
The job already runs only on `main`, including manual publication. Tag-triggered
GitHub release repairs do not publish to npm or use this environment.
The environment name in npm's trusted-publisher settings must match `npm`.

The publishing job has `id-token: write` permission and uses npm 11.21 or later
with OIDC. Tag management requires the separate **Allow npm dist-tag** permission
in the trusted-publisher settings; permission to publish alone is insufficient.
No npm token secret or interactive login is needed in Actions. pnpm prepares
the tarball so `publishConfig.exports` and bundled workspace packages are
handled correctly; npm publishes that tarball with provenance. Packaging does
not run the native renderer or clone content repositories.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
If direct publication is disabled on npm, this workflow fails; it does not
silently switch to staged publishing.

## What the actions do

| Workflow | Trigger | Result |
| --- | --- | --- |
| Prepare release (`version.yml`) | Changesets on `main`, or manual run on `main` | Opens/updates the version and changelog PR. |
| Publish release (`release.yml`) | Package manifest changes on `main` | Publishes only when the version changes, then creates the tag and GitHub release. |
| Publish release (`release.yml`) | Manual run on `main` with an empty tag | Attempts the current prepared release, including retrying an interrupted publication. |
| Publish release (`release.yml`) | Manual run on `main` with `sync_tags` enabled and an empty tag | Repairs `latest` for the already-published beta without rebuilding or republishing. |
| Publish release (`release.yml`) | Push of `@allmaps/slides@*`, or manual run with an existing tag | Creates the GitHub release only; does not publish to npm. |
| Slides architecture (`slides.yml`) | Every pull request, or manual run | Tests the CLI, app, renderer, development server and installed package; skips tests for documentation-only PRs. |
| Static renderer (`static-render.yml`) | Every pull request, or manual run | Tests the Linux renderer container; skips tests for documentation-only PRs. |
| Deploy to GitHub Pages (content repos) | Push to `main`, or manual run | Installs the pinned npm package, builds content and deploys the site. |
| Build and Publish Docker Image (Kattenburg) | Push to `main`, version tag, or manual run | Builds the site and publishes an Nginx image to GHCR. |

GitHub Actions must be allowed to create pull requests under repository
**Settings → Actions → General**. GitHub may ask you to **Approve workflows to
run** on the automatically created version PR. Approve them and let the required
checks finish before merging. If the PR has no checks or approval prompt,
close and reopen it from your own account. Manual workflow runs do not satisfy
required PR checks. See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).

The release job creates the GitHub release directly after publishing because
tags pushed by `GITHUB_TOKEN` do not trigger another workflow run.
Content repositories must select **GitHub Actions** as their Pages source under
**Settings → Pages**. The software integration workflow initializes only the
public Slides template.

## Recover an interrupted release

- Rerun the failed **Publish release** run to retry the same source commit.
  If npm already has that version, the workflow verifies its published source
  stamp and finishes tagging and creating the GitHub release without republishing.
- If the version on npm or an existing tag belongs to a different commit, the
  workflow stops. Rerun the original source commit or prepare a new version;
  never move a published version's tag to different source code.
- For a missing GitHub release when the tag already exists, run **Publish
  release** manually with that exact tag. An existing release is left unchanged.
- A manual run with an empty tag uses the selected `main` commit. Use it only
  when that commit is the prepared release. If more work has landed on `main`,
  rerun the original failed run instead.
- If `beta` is current but `latest` still points to an older beta, enable
  **Allow npm dist-tag** for the trusted publisher, then run **Publish release**
  on `main` with `sync_tags` enabled and `tag` empty. This uses the package version
  on `main`, requires it to match npm's current `beta`, and never replaces a
  stable or newer `latest`. It needs no new package version or Git tag.

GitHub supplies source ZIP/tar downloads for tagged releases. The first npm
publication also received `latest`; the release workflow now keeps that default
current throughout beta. The `-beta.N` version suffix and GitHub prerelease status
remain unchanged. A version already accepted by npm cannot be overwritten.

## Local fallback

If Actions is unavailable, publish from the exact prepared release commit with
Node.js 24, pnpm 10.22.0 and a clean software working tree:

```sh
pnpm install --frozen-lockfile
pnpm release:check
npm login --auth-type=web
pnpm release:publish
git push origin '@allmaps/slides@0.1.0-beta.2'
```

Replace the example tag with the version just published. `release:publish`
rebuilds the package, publishes, synchronizes npm tags using the same policy, and
creates a local annotated tag. Complete npm's publishing authentication when
prompted. Pushing the tag creates the GitHub release. Coordinate this fallback with any running
Actions publication so they do not attempt the same version concurrently.

To repair only npm tags from a checkout of the published version, run
`pnpm release:tags` after logging in. Add `--dry-run` to inspect the proposed
change without modifying npm.

Use these release commands instead of `changeset publish` to keep source
validation, npm tags and GitHub releases on the same workflow.

## Finish beta

Run `pnpm changeset pre exit`, then `pnpm release:version`. Review, commit and
merge the changes. With the current target, this produces `0.1.0` and triggers
publication on `latest`. Keep Changesets' `.changeset/pre/` records until
Changesets removes them. To prepare a version PR's changes locally instead of
using the action, run `pnpm release:version` and commit its output.
