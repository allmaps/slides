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

The template uses remote images and a Protomaps basemap. Its
[README](../content/slides-template/README.md#preview) explains how to replace
the demo API key when copying or forking it.
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

Only `@allmaps/slides` is published; the bundled app and helpers share its version.
Add a changeset for changes to the CLI, app or helpers with `pnpm changeset`.
See [publish versions and GitHub releases](releases.md) for the complete process,
workflow responsibilities, npm authentication and recovery steps.

Content repositories have their own pinned package dependency and lockfile.
They are not workspace packages, so preparing a software release does not need
content submodules. Initialize a submodule only when developing that presentation.

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

Every pull request reports the required `integration` and `container` checks.
Documentation-only changes pass after a quick file check, without installing
dependencies or building the container. The shared rules in
[`.github/test-paths.yml`](../.github/test-paths.yml) exclude guides, software
READMEs, changelogs and changeset notes. All other paths run the full checks,
including configuration, licenses, workflows and content submodules. Manual
workflow runs always run the full checks; a failed change-detection step fails
the required check.

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
