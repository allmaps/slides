# Slides architecture migration

The agreed design combines the model, directory loader, build tooling, Vite
integration and CLI in `@allmaps/slides`. The application remains in
`apps/slides`; IIIF generation, static rendering and the Svelte viewer remain
independent packages. Each content directory builds a separate site. Map
thumbnails refresh on build or an explicit command, not on ordinary dev edits.

## Stages

1. Complete (11 tests, TypeScript, all three content roots): combine Slides packages; load plain content directories; use one
   resolved configuration and generated content registry.
2. Complete (16 Slides tests, renderer tests, type checks): move thumbnail planning/build orchestration out of the app; remove
   the renderer's dependency on the Slides model.
3. Complete (6 IIIF tests, including source replacement, cache isolation and concurrent publishers): explicit IIIF catalog and content-aware cache; isolate projects.
4. Complete (two-site HTTP/HMR smoke, config/base-path restarts and native pixel alignment): Vite watching, add/remove/rename handling and dev refresh tests.
5. Complete: compiled releases, packaged application, external installation smoke
   tests, documentation and CI migration.

## Final verification

- All workspace unit/component tests and Slides/IIIF/renderer TypeScript checks pass.
- Existing content roots validate: Gravity at Sea (31 slides), Kattenburg (35)
  and basemap fixtures (10).
- Svelte checks exercise actual app sources, including when installed under
  `node_modules`: zero errors, one existing `Map.svelte` warning about the
  initial `anticipate` value.
- Independent dev servers pass actual HTTP/WebSocket tests for content changes,
  image replacement/removal, thumbnail completion and config/base-path restarts.
- A fresh repository installs the four packed release archives, validates its
  content, checks the bundled app and exports a site under `/story`. Its static
  output contains HTML, IIIF metadata/pixels and native map thumbnails. A repeat
  build reuses all six thumbnail render/encode results and the IIIF pixels.
- The migrated Linux/amd64 Docker build image passes package checks and native
  pixel alignment. GitHub workflows are updated; they have not been dispatched.

The current upstream `@allmaps/annotation@1.0.0-beta.37` schema rejects Zod 4.6.5.
The consumer smoke explicitly pins Zod 4.4.3 using the documented root override.
This temporary release prerequisite remains open for review; there is no silent
dependency patch or bundling workaround. No packages have been published and no
sites deployed.

Existing uncommitted work was present before this migration, including thumbnail
documentation, app regression tests, deployment workflows and the Kattenburg
submodule. It is preserved and adapted where required.
