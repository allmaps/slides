# @allmaps/slides-model

Shared, data-only Slides content and map decisions. The app, CLI and static
renderer consume this package; it does not import Svelte, Vite aliases,
`$env`, content packages, filesystem APIs or native graphics libraries.

## Exports

- `config`: YAML/JSON config parsing, explicit environment substitution and
  Markdown frontmatter extraction.
- `content-schema`: Zod config/frontmatter schemas and normalized app values.
- `project`: chapter ordering, slugs, project construction and reference
  validation. `buildProject(config, files, resolveAsset)` accepts metadata and
  an optional asset URL adapter. Chapters retain `sourcePath`; the app attaches
  their compiled Svelte components afterwards.
- `types`, `settings`, `thumbnails`: shared types, defaults and manifest keys.
- `basemap`, `geojson`, `map/*`: theme/style inheritance, layer visibility,
  annotation identity, faux image maps and camera fitting. Style files,
  fetch implementations and credentials are supplied by callers.

The CLI validates content with the same schemas/project builder used by the
app. Runtime-specific paths and environment access remain in the CLI; content
imports, routes, UI and component lifecycle remain in the SvelteKit app.

These are workspace TypeScript source exports. Vite consumes them in the app;
Node 24 runs them directly in the CLI and tests.

```sh
pnpm --filter @allmaps/slides-model test
pnpm --filter @allmaps/slides-model check
```
