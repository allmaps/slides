# Release notes

Run `pnpm changeset` for a change that should ship in the next release. Select
`@allmaps/slides` and describe what changes for authors or readers, including any
configuration migration. App, IIIF, renderer and canvas-panel changes all ship
as this one package, even when their source lives in another workspace folder.

These summaries become the package changelog and GitHub release notes. Keep each
to a few sentences about user-visible changes. Include required migration steps
and removed options; link to documentation for examples and detailed behavior.

Content-only changes belong in the content repository's history. Changes that
do not need a release do not need a changeset.

The package is in beta prerelease mode. Changesets maintains the beta counter
and changelog; do not edit versions for subsequent releases by hand.
See [the release workflow](../docs/development.md#releases).
