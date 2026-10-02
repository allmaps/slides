# Publish versions and GitHub releases

Slides has three independent outputs: the npm package, a GitHub release with
notes, and each content repository's deployed website. Publishing one does not
automatically publish the others.

Only `@allmaps/slides` goes to npm. Its version is in
[`packages/slides/package.json`](../packages/slides/package.json); the app and
bundled helpers share that version. The first published version is `0.1.0-beta.1`.
Use Node.js 24 and pnpm 10.22.0. Run software release commands in the Slides root.

## Publish the next version

1. Make and test the software change. Run `pnpm changeset`, select
   `@allmaps/slides`, choose the change type and describe the user-visible change.
   Commit the generated file with the code and merge it into `main`.
2. **Prepare release** opens or updates a version PR. It increments the version,
   writes the changelog and updates the lockfile. During beta, a patch advances
   `0.1.0-beta.1` to `0.1.0-beta.2`. Review and merge this PR. It does not publish.
3. Check out the resulting commit and make sure it has been pushed to GitHub.
   With a clean software working tree, run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm release:check
   npm login --auth-type=web
   pnpm release:publish
   ```

   Complete npm's browser/passkey authentication. Email login verification alone
   does not replace a configured publishing second factor. See
   [npm's 2FA setup](https://docs.npmjs.com/configuring-two-factor-authentication/).
   The command rebuilds and publishes the package to `beta`, then creates a local
   annotated tag such as `@allmaps/slides@0.1.0-beta.2`. For a regular version it
   selects `latest`. No workflow currently publishes to npm.
4. Push that tag (replace the version with the one just published):

   ```sh
   git push origin '@allmaps/slides@0.1.0-beta.2'
   ```

   **Release notes** creates the matching GitHub prerelease from the changelog.
   GitHub provides source ZIP/tar downloads. This does not upload to npm again.
5. Upgrade each content repository that should use the new software:

   ```sh
   pnpm add -D -E @allmaps/slides@0.1.0-beta.2
   pnpm validate
   pnpm build
   ```

   Commit `package.json` and `pnpm-lock.yaml` in that content repository and push.
   Its deployment workflow installs the locked version and rebuilds the website.
   A Slides release does not silently upgrade existing presentations.

[Software checks](development.md#checks) cover the package and application.
Content changes belong in the content repository and need no Slides changeset.
Local content edits do not block `release:check`.

## What the actions do

| Workflow | Trigger | Result |
| --- | --- | --- |
| Prepare release (`version.yml`) | Changesets on `main`, or manual run on `main` | Opens/updates the version and changelog PR. No publication. |
| Release notes (`release.yml`) | Push of `@allmaps/slides@*`, or manual run with an existing tag | Creates the GitHub release; beta versions are prereleases. |
| Slides architecture (`slides.yml`) | Relevant pull requests, or manual run | Tests the CLI, app, renderer, development server and installed package. |
| Static renderer (`static-render.yml`) | Relevant pull requests, or manual run | Tests the Linux renderer container. |
| Deploy to GitHub Pages (content repos) | Push to `main`, or manual run | Installs the pinned npm package, builds content and deploys the site. |
| Build and Publish Docker Image (Kattenburg) | Push to `main`, version tag, or manual run | Builds the site and publishes an Nginx image to GHCR. |

GitHub Actions must be allowed to create pull requests under repository
**Settings → Actions → General**. PRs created with `GITHUB_TOKEN` may not trigger
other workflows automatically; manually run Slides architecture and Static
renderer on the version PR branch when needed. Content repositories must select
**GitHub Actions** as their Pages source under **Settings → Pages**.

Version preparation installs only the software workspace. It does not clone
content repositories or require a token with access to private content. The
integration workflow initializes only its public Gravity at Sea presentation.

## Recover an interrupted release

- If npm publishing fails, no tag is created. Resolve the error and retry the same
  version after checking `npm view @allmaps/slides versions --json`.
- If npm succeeded but there is no GitHub release, check `git tag --list
  '@allmaps/slides@*'` and push the existing tag. Do not republish or move the tag.
- If npm succeeded but local tagging failed, check that you are on the exact
  published source commit, then run `pnpm exec changeset git-tag` and push the tag.
- If the tag is already on GitHub but the release action failed, rerun the job,
  or manually run Release notes with that tag. The workflow leaves an existing
  release in place, so retries are safe.

The first npm publication also received `latest`; install an explicit version
or use `@beta` when selecting the beta channel. A version already accepted by
npm cannot be overwritten. `pnpm release:publish` does not push Git commits/tags.
Do not use `changeset publish` here: it can select `latest` for a package whose
first stable release has not yet been published.

## Finish beta

Run `pnpm changeset pre exit`, then `pnpm release:version`. Review, commit and
merge the changes and follow the same publish/tag steps. With the current target,
this produces `0.1.0` on `latest`. Keep Changesets' `.changeset/pre/` records until
Changesets removes them. To prepare a version PR's changes locally instead of
using the action, run `pnpm release:version` and commit its output.

Future npm automation can use [trusted publishing](https://docs.npmjs.com/trusted-publishers/)
with a dedicated GitHub workflow. It needs a matching trusted-publisher setup in
npm; the release-notes workflow and its GitHub token alone do not grant npm access.
