# Images, thumbnails and caches

During development, generate local IIIF images and map previews explicitly:

```sh
pnpm exec slides iiif .
pnpm exec slides thumbnails .
```

A production build runs both generators automatically. Normal edits and page
requests use the last completed batches. This guide covers user-facing settings;
[architecture](architecture.md) and [thumbnail generation](thumbnail-generation.md)
describe the implementation.

## Optional generation and asset overviews

The `/iiif/` page counts images and lists generated image services, dimensions
and previews. Manifests are nested under their collection. Each collection,
manifest and image-service link has a copy-URL button; collections and manifests
also link to Allmaps Editor and Theseus Viewer. Links use the current site address
in the browser, including a local dev host/port, and the configured public URL
in the prerendered HTML.

`/thumbnails/` groups light/dark slide previews, map-layer previews and sharing
images in horizontally scrollable rows per slide. Its compact table of contents
links to each row, with per-slideshow and expand/collapse-all controls. Sharing images are labelled
**Open Graph / Twitter**; these are separate from the in-app previews. Both pages
work beneath `site.basePath` and read completed batches without generating images.
These routes are reserved and cannot be used as slideshow slugs.

Both generators are enabled by default. Disable either independently:

```yaml
iiif:
  enabled: false
thumbnails:
  enabled: false
```

Disabled generators are skipped by both their CLI command and the site build;
their overview shows a disabled message. Previously cached results are not served.
Disabling thumbnails also omits image social tags and thumbnail cards in the app.
`SLIDES_THUMBNAILS_ENABLED=false` remains an environment override for CI.

An images-only content directory is valid: provide a `slides.config.yml` with a
title and put images in `assets/images/`. Omit `slideshows` (or use an empty chapter
directory). The built home page explains that no slides have been added and links
to the IIIF overview. No thumbnail renderer is started for an empty project.

With IIIF disabled, local Markdown images under `assets/` are served directly:

```md
![Shipyard](assets/images/shipyard.jpg)
```

Opt into the Atlas preview and zoom modal without generating IIIF:

```html
<figure data-image="assets/images/shipyard.jpg" aria-label="Shipyard">
  <figcaption>The shipyard.</figcaption>
</figure>
```

This loads the complete original image to obtain its dimensions and display it;
it cannot load tiles on demand. Regions and rotation still work. External IIIF
services remain usable regardless of local generation settings. Local images
used as warped map layers still require generated IIIF services.

All IIIF CLI generation options can be set in configuration:

```yaml
iiif:
  enabled: true
  input: assets/images
  # output: exported-iiif             # optional standalone CLI export
  # id: https://images.example.org/iiif # otherwise site.publicUrl + /iiif
  # collectionLabel: Image archive     # otherwise the overall title
  force: false
  sizes: true
  tiles: true
  tileSize: 1024
  webp: true
```

`input` and `output` are relative to the content directory. CLI arguments take
precedence, with paths relative to the invoking directory. Use `--no-sizes`,
`--no-tiles`, `--no-webp` or `--no-force` to override enabled YAML options.
JPEG full-image output is always generated; `webp` adds WebP derivatives.
`force: true` regenerates unchanged derivatives on every generation run.

## Refreshing and clearing caches

Vite hot-updates application code and automatically reloads the site for Markdown
and asset edits, additions, renames and deletions. Configuration edits restart Vite;
invalid content appears in its error overlay. Content is never synchronized
into another source folder.

Local IIIF images and map thumbnails use their last successful batches. Run
`slides iiif .` and `slides thumbnails .` explicitly to refresh them; the dev
server reloads when each batch completes. Page requests never start generation
or wait for a running batch. Until the first IIIF batch is ready, missing local
images return 404 promptly and the rest of the page remains usable.

Run `slides iiif .` after adding, replacing or deleting source images. Existing
images stay available during generation, and a failed batch leaves the previous
catalog intact. Unchanged derivatives are reused from the cache. Use the same
content directory, `--config`, `--cacheDir` and deployment settings as the dev
server. Local IIIF metadata follows the dev server's origin and base path without
regenerating pixels; an explicitly configured `iiif.id` is preserved.

The IIIF command publishes to the private cache by default. To also export a
standalone directory, use `slides iiif . --output ./iiif` or configure
`iiif.output`. Production builds still prepare thumbnails and IIIF automatically
before exporting the application.

The Vite cache defaults to `node_modules/.vite`. Derivatives and remote inputs
live under its `slides` directory. Each real content root, selected config and
deployment URL has its own application workspace and catalogs. Development and
production have separate SvelteKit output. Completed thumbnail manifests and
IIIF catalogs are shared between those modes. When the cache is under
`node_modules`, the dev runner and SvelteKit output live in `.slides/` in the
working directory so Vite does not cache application modules as dependencies.
Add `.slides/` to your `.gitignore`. Generated files never modify the installed
application. Restart an existing dev server once after upgrading to this layout.

Stop the affected dev server before clearing caches:

```sh
slides cache purge . --dry-run  # list project workspace/catalog paths
slides cache purge .            # clear this project's workspace and catalogs
slides cache purge . --all      # also clear shared derivatives/downloads and all projects
```

Use the same content, config, deployment settings and `--cacheDir` as the build.
`--all` clears the selected cache directory's `slides/` namespace and, for a
cache under `node_modules`, the separate `.slides/projects/` dev runners. It leaves
source content, exported IIIF directories, built sites and package dependencies
alone. Explicit `SLIDES_THUMBNAILS_CACHE_ROOT`/`SLIDES_ANNOTATIONS_CACHE_ROOT`
locations outside that namespace are not removed. Regenerate IIIF/thumbnails
after purging, or run a build. A project-only purge retains shared pixels so they
can be reused; `--all` forces fresh inputs and renders.

Linux thumbnail generation requires graphics libraries and Xvfb; see the
[renderer setup](static-render.md#linux-setup). `dev`, `validate` and `check` do
not start native rendering. `SLIDES_THUMBNAILS_ENABLED=false` skips thumbnails
during builds. Remote map sources still need their usual credentials/network.
