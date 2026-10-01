# Develop and release Slides

Use Node.js 24 or later and pnpm 10. Run commands in this guide from the
Slides repository root unless stated otherwise.

## Source checkout

```sh
git clone https://github.com/allmaps/slides.git
cd slides
pnpm install
git submodule update --init content/slides-template
pnpm exec slides dev ./content/slides-template
```

The template uses remote images and an empty basemap, so it needs no provider key.
To work on another bundled content repository, initialize its submodule and pass
that directory instead. `git submodule update --init --recursive` initializes all
content repositories in a fresh checkout.

For a content repository cloned separately alongside `slides`, run:

```sh
pnpm exec slides dev ../my-story
pnpm exec slides validate ../my-story
```

Keep editing the original content files. Markdown and assets reload automatically;
configuration edits restart the server. Use a different `--port` for each server.
Refresh generated images with the [generation commands](generation.md).

The root shortcuts `pnpm dev`, `pnpm build`, `pnpm check`, `pnpm validate`,
`pnpm iiif` and `pnpm preview` select Gravity at Sea. Initialize that submodule
before using them. Local fixtures can live in the ignored `content/tests/`:

```sh
pnpm exec slides dev ./content/tests --port 5175
```

Generated sites, `node_modules/.vite/slides` caches and `.slides/` development
runners are ignored by Git. Add `dist/`, `node_modules/` and `.slides/` to the
ignore file in a new standalone content repository.

## Bundling and packing

```sh
pnpm bundle
pnpm test:package
pnpm --filter @allmaps/slides pack --pack-destination ../../artifacts
```

`bundle` builds one distributable `@allmaps/slides` package. It includes the
workspace IIIF and renderer code, preprocessed Svelte canvas components, type
declarations and application source. The helper packages are private workspace
packages; only `@allmaps/slides` is published. External npm dependencies, including Sharp and Chiitiler,
remain runtime dependencies installed by the consumer's package manager.

`pack` and `publish` rebuild through the `prepack` hook. `pnpm build` at the
repository root builds a presentation; `pnpm bundle` builds the npm package.
The smoke test packs, installs and exercises a release without publishing it.

The implementation lives in:

- [tsdown.config.ts](../packages/slides/tsdown.config.ts): entry points, types and dependency rules.
- [build-package.mjs](../scripts/build-package.mjs): workspace build dispatcher.
- [bundle-slides.mjs](../scripts/bundle-slides.mjs): tsdown, Svelte packaging and app copying.

Generated import strings are not patched. The packaged renderer runs in a
separate Node process; the app's IIIF virtual module contains configuration
data, with behavior imported through ordinary server modules.

To try a release archive, run this in a separate content repository, replacing
the path with the archive produced by `pack`:

```sh
pnpm add -D /absolute/path/to/allmaps-slides-0.1.0-beta.1.tgz
pnpm exec slides validate .
pnpm exec slides dev .
```

The current dependency set needs no Zod override. Remove an old `zod: 4.4.3`
override when upgrading and update the lockfile. Native Linux rendering still
needs [system dependencies](static-render.md#linux-setup).

## Releases

`packages/slides/package.json` owns the public version, starting at
`0.1.0-beta.1`. The bundled app and helper packages share that release. Their
internal manifest versions are not separate public releases.

For a user-visible change to the CLI, app or a bundled helper, run
`pnpm changeset`, select `@allmaps/slides`, and describe what changed. Commit the
generated Markdown file with the change. Content-only changes belong in their
content repository's history and do not need a Slides changeset.

The version workflow opens a release PR after changesets reach `main`. It updates
the version, changelog and prerelease state. Enable GitHub Actions' permission to
create pull requests in the repository settings. To prepare the same changes
locally, run `pnpm release:version` and commit the result. During beta, Changesets
advances `0.1.0-beta.1` to `0.1.0-beta.2`, and so on. A minor or major changeset can
also change the target regular version.

Keep the content submodules initialized when refreshing the workspace lockfile
(`git submodule update --init --recursive` in a clean release checkout). The
version workflow does this too, so it retains their dependency entries.

For each release:

1. Review the version PR and run the [checks below](#checks). The release PR uses
   `GITHUB_TOKEN`, so run the Slides CI workflow manually on its branch if GitHub
   does not trigger checks automatically. Merge the reviewed version changes.
2. Check out the resulting clean, pushed commit and run `pnpm install --frozen-lockfile`
   followed by `pnpm release:check`. Local content changes are excluded from this
   check. Confirm that the software commit is accessible on GitHub before publishing.
3. With npm access to `@allmaps/slides`, run `pnpm release:publish`. This rebuilds
   and publishes the package, explicitly selects the `beta` npm tag for a beta version, and
   creates a local Git tag such as `@allmaps/slides@0.1.0-beta.1`.
4. Run `git push --follow-tags`. The release workflow creates a GitHub prerelease
   with the corresponding changelog section. GitHub supplies its usual source
   downloads; no separate source archive is uploaded.

Use this publish command rather than `changeset publish`: Changesets can choose
`latest` for packages that have not had a stable release, leaving `beta` behind.

The initial `0.1.0-beta.1` version and changelog are already prepared; no version
bump is needed for its first publication. Packing and testing never publish.
An npm package's first publication may also receive the `latest` tag, so check
the registry tags after that first release. The documented install uses `@beta`.

When ready for a regular release, run `pnpm changeset pre exit` followed by
`pnpm release:version`, review and commit the changes, then follow the same
release steps. With the current target, this produces `0.1.0` on npm's `latest`
tag. Keep Changesets' generated `.changeset/pre/` records in Git until it removes
them during that transition.

The package's [README](../packages/slides/README.md) is included at the archive root
and becomes its npm landing page. Keep its documentation links absolute so they
work on npm. Detailed guides remain in this repository's `docs/` directory.

## Software identity in credits

Packing writes `build-info.json` inside the package with its version, software
commit and source state. The app uses that metadata in the automatic credits
footer, and built sites expose it at `_app/slides-build.json`. A clean packaged
build links to the exact GitHub source commit and the matching release notes.
The license link opens the repository's `LICENSE.md` at that commit, or on `main`
for development builds. Packages without a repository URL link to the bundled
software notice instead.

Source checkouts show a development label. Uncommitted software changes show a
modified label and omit links that would incorrectly identify the base commit
as the complete source. Content changes do not affect this status. Builds without
usable source metadata show a development label without an exact source link.
The metadata never reads a consumer's Git commit, package version or CI variables,
and does not contain content paths or repository URLs.

For a fork, set the Slides package's `repository.url` to its public GitHub repository
before committing and packing. A custom application selected with `app.directory`
can provide its matching public source using `app.sourceUrl`; its source link
does not default to the bundled app. See [configuration](configuration.md#credits-and-chapter-numbering)
and [licensing](licensing.md#distributing-a-site).

## Checks

```sh
pnpm -r test
pnpm --filter @allmaps/slides check
pnpm --filter @allmaps/iiif check
pnpm --filter @allmaps/static-render check
pnpm --filter @allmaps/svelte-canvas-panel check
pnpm --filter @allmaps/slides test:dev
pnpm --filter @allmaps/slides test:assets
pnpm test:package
```

The dev smoke runs two independent sites and checks HTTP/WebSocket updates.
The asset smoke checks generated overview pages. The package smoke installs a
single archive in a fresh content repository and exercises type checks, dev,
IIIF, native pixels and repeat production builds. It requires registry access
and a working native renderer.

Package-specific tests and Docker checks are documented with the
[renderer](static-render.md), [IIIF generator](iiif.md) and
[canvas panel](canvas-panel.md).

## Documentation

Keep READMEs focused on purpose, one way to get started and links.
Put authoring examples and technical contracts in the [documentation index](README.md).
Content-specific attribution, migration notes and deployment settings belong in
that content repository's own `docs/` directory so it can be used independently.
When changing behavior, update its canonical guide and the template's annotated
references rather than repeating the same details across READMEs.
