# Architecture

## Responsibilities

`@allmaps/slides` is one public package with internal `model`, `content`, `build`,
`vite` and `cli` modules. These layers do not require independent versioning.
The CLI selects a directory and delegates to the build API. The loader resolves
one configuration, validates Markdown metadata and builds a data-only project.
Both thumbnail planning and the application consume that same project.

`apps/slides` owns Svelte components, Markdown presentation, navigation and
public routes. It consumes generated content and completed derivative catalogs.
It does not discover content, plan map thumbnails or invoke native rendering.
The app remains a private workspace for development and is bundled as source
inside the published Slides package for compilation against each site's content.

`@allmaps/iiif` owns image decoding and static Image/Presentation API generation.
`@allmaps/static-render` owns neutral map scene rendering. Neither imports
Slides. `@allmaps/svelte-canvas-panel` owns the reusable browser IIIF viewer.

## Data flow

```text
Content directory
  └─ Slides content loader → validated project + discovered source assets
       ├─ thumbnail planner → static-render → completed thumbnail catalog
       ├─ IIIF generator → completed public asset catalog
       └─ Vite content adapter → Markdown components + project + asset imports
                                    └─ SvelteKit → static site
```

The Vite adapter emits explicit asset imports and the resolved project/configuration.
A separate Markdown module imports compiled components, avoiding a dependency
cycle when those components read configuration or image metadata. Neither
module generates images. The server module only supplies the path of a
prepared IIIF catalog. Routes read that catalog and serve/prerender its listed
files. No author-written JavaScript entry point is required.

## Public URLs and caching

Local IIIF services use stable paths such as `/iiif/maps/ship/info.json`, derived
from paths beneath the configured image root. They are separate from internal
cache keys. Source bytes, derivative options, generator revision and Sharp
versions determine reusable pixel-cache entries; public URL changes create new
metadata without recomputing identical pixels. Replacing an image with another
of the same dimensions still invalidates its derivatives.

Each publication has its own catalog. Deleted source files disappear from that
catalog even if older files remain cached. A catalog is replaced atomically
only after all its assets are ready. The route exposes only listed requests.
Because IIIF URLs are stable, static hosting should revalidate these resources,
not mark them immutable. Map thumbnails use hashed filenames and can be served
with immutable caching.

The default cache is `<invocation-directory>/node_modules/.vite/slides`:

| Location | Lifetime and scope |
| --- | --- |
| `iiif/images/<recipe>` | Reusable pixels shared across sites. |
| `annotations`, `thumbnails` | Validated remote inputs and render recipes. |
| `projects/<key>/thumbnails` | Last completed thumbnail batch for one site/configuration. |
| `projects/<key>/{development,production}` | Isolated app runner, SvelteKit output, Vite cache and IIIF publication. |

The project key includes the real source directory, config filename and public
URL/base path. The app runner links to original source files and installed
dependencies. Nothing is copied into a content shadow directory or written
into installed packages. Remove the cache to rebuild derivatives; do not edit
it as source. Separate output directories are required for simultaneous builds.

## Watching and multiple sites

Select each site explicitly with `slides dev <directory>` or
`slides check <directory>`. Use distinct ports for simultaneous servers.
Vite handles content additions, edits, deletions and renames. Configuration
changes revalidate and restart that server. Invalid content produces an overlay;
the next valid edit recovers it.

Text and asset edits refresh immediately. IIIF generation runs on demand in
development. Map thumbnails remain at the previous completed batch until
`slides thumbnails <directory>` or `slides build <directory>` runs. The dev
server observes the thumbnail manifest so a completed explicit batch appears
without restarting the server manually.

## Migration and releases

Remove content `index.js`/`index.ts` exports. A `package.json` is optional and
can remain for package-name selection. Replace imports from
`@allmaps/slides-model` with `@allmaps/slides/model` subpaths. Replace the old
CLI and content proxy with `@allmaps/slides`. IIIF is now `@allmaps/iiif`.
Output defaults to the selected content directory's `dist`; CI should pass an
explicit `--outDir` and upload that directory.

Coordinated releases include Slides, IIIF, static-render and the Svelte viewer.
All publish compiled JavaScript/declarations; Slides also includes app sources.
Packing and installing archives into a fresh content-only repository is the
release acceptance test. No package publication or site deployment is performed
by that test.
