# @allmaps/slides

Create a static map story from a content directory. This package contains the
CLI, schemas, content loader, build tools and the SvelteKit application. Content
needs no `index.js`, Vite configuration or content-package exports.

## Commands

Use Node 24 or later. After installing the published package in your content
repository with `pnpm add -D @allmaps/slides`:

```sh
pnpm exec slides dev .
pnpm exec slides validate .
pnpm exec slides check .
pnpm exec slides thumbnails .
pnpm exec slides iiif .
pnpm exec slides build .
pnpm exec slides preview .
```

The current upstream `@allmaps/annotation@1.0.0-beta.37` is incompatible with
Zod 4.6.5. Until that schema is fixed upstream, consumers need this temporary
pin in their root `package.json`, then should commit their lockfile:

```json
{ "pnpm": { "overrides": { "zod": "4.4.3" } } }
```

For npm, use the root `"overrides": { "zod": "4.4.3" }` field instead. A
dependency cannot enforce a transitive override on the consumer's behalf.
The package smoke uses this documented workaround explicitly.

This repository prepares release archives with `pnpm --filter @allmaps/slides
pack`; it does not publish them automatically. Until the coordinated packages
are released, use the monorepo CLI or locally packed archives. The
`test:package` script demonstrates installing the four local archives together.

Paths select independent sites. A named installed/workspace content package
also works, but its only required role is locating the content directory.
With no argument, the current directory is selected.

```text
my-story/
  slides.config.yml
  chapters/
    01-introduction.md
  assets/
    images/
    data/
    map-styles/
```

```yaml
title: My story
main: main
slideshows:
  - id: main
    path: chapters
site:
  publicUrl: https://example.org/story/
  basePath: /story
```

Configuration paths and assets are relative to the content directory.
`--config <file>`, `--cacheDir <directory>` and `--outDir <directory>` are
relative to the invoking working directory. Output defaults to `<content>/dist`.
Vite options such as `--port 5174` pass through to `dev`/`preview`.

## Shared GeoJSON overlays

Declare GeoJSON sources in the content configuration to show them throughout
the project, in both the interactive map and slide/social thumbnails:

```yaml
sources:
  route:
    type: geojson
    path: assets/geojson/route.geojson
```

Feature properties control the appearance using SimpleStyle: `stroke`,
`stroke-width`, `stroke-opacity`, `fill`, `fill-opacity`, `marker-color` and
`marker-size`. Omitted properties use the shared default style. For example,
`{"stroke":"#64c18f","stroke-width":8}` draws a green route. Regenerate
thumbnails after changing the geometry or style with `slides thumbnails .`.

## Credits and navigation

All slides are included in chapter numbering and totals, including the start
screen count. Chapters start at 1. Sections in one subslideshow use `1.1`, `1.2`,
and so on; multiple subslideshows under a chapter add a level: `1.1.1`, `1.2.1`.

Configure one shared Markdown credits document at the top level. A slideshow can
also specify its own document, which is appended after the shared credits:

```yaml
credits: credits.md
slideshows:
  - id: main
    path: chapters
  - id: history
    path: history
    credits: history/credits.md
```

The info panel takes its title from the shared document's frontmatter (or the
slideshow document when no shared document exists). Additional documents use their
own frontmatter titles as section headings:

```md
---
title: Acknowledgements
---

Created by our contributors. [Sources](https://example.org).
```

Paths are relative to the content directory and must name existing `.md` files
inside it. Frontmatter is optional; the configured interface label is the fallback
title. Referenced credits files are excluded from chapter lists and update live.

The navigator includes chapter links, a progress bar based on the current chapter,
and menus for maps, chapters, theme and panel visibility. Clicking the chapter
count opens the chapters overlay. The navigator floats
over the bottom of the reading panel. At 1536px, the reading panel widens from
480px to 600px and the navigator sits beside its left edge at 480px wide.
Hiding the text centers the navigator across the full screen at this wide
breakpoint; on smaller desktop screens it stays against the right edge. Position
changes animate on resize and visibility changes.
A subslideshow begins with its title and a back arrow above the first chapter,
inside the scroll. Footer actions return to the main slideshow or, on the right,
to the top. The numbered chapter button beneath each title opens the chapters
overlay. The map button beside it shows the map count and opens the map layers
panel; its singular/plural labels can be translated with `mapCountSingular` and
`mapCountPlural`. The navigator count also opens the chapters overlay.
On mobile, drag the handle between full, half-height
and collapsed positions. The rounded card keeps a margin above the bottom edge and moves behind the
fixed navigator. When collapsed, only the card's handle
and a border around the navigator remain visible. The progress bar stays visible
in every position. The expanded card stops below the app title, with the same
margin as around the edges. Tapping the handle also animates the card open.
The maps, chapters and credits overlays open above the navigator. Opening them
does not change the map padding. On mobile, they fit inside the current card,
below its handle, without expanding it. With the card collapsed, overlays float
above the navigator. On wide desktop layouts, overlays can use all the space
between the top screen margin and navigator. Expanding the mobile card to its
maximum height preserves the map's previous framing.

Keyboard shortcuts: **Left / Right** for previous / next chapter, **B** to return
to the main slideshow and **H** to hide / show the sidebar. Shortcuts leave text
entry, modified browser shortcuts and image dialogs alone. The mobile handle also
supports **Up / Down**, **Home** (hide) and **End** (expand).
Rapid chapter navigation advances from the latest requested chapter while smooth
scrolling settles; manual scrolling can interrupt it without snapping back.

## Logos and theme-aware images

Store logos and other interface artwork in `assets/logos/`, outside the IIIF
input directory (`assets/images/` by default). SVGs anywhere under `assets/`
are served directly as vectors and never converted to IIIF. Raster images
outside the IIIF input are also ordinary assets. Vite includes these files in
production builds and resolves the site's base path automatically.

Ordinary Markdown image syntax works for a single version. For light/dark
alternatives, use an ordinary HTML image with `data-dark-src`:

```html
<img src="assets/logos/institution-light.svg"
       data-dark-src="assets/logos/institution-dark.svg"
       alt="Institution name" height="60" />
```

`src` is the light version and `data-dark-src` is optional. The alternative follows
the slideshow's theme switch, with the system preference as the initial fallback.
This works in credits and slide Markdown without component imports,
content-specific code, or a filename convention. Both versions should have the same viewBox
and aspect ratio.
Specify just `height` or just `width` (in pixels) to size the image while keeping
its original proportions. Images also fit within the available panel width
without stretching.

For linked credits logos, wrap images in ordinary HTML links inside a
`<div class="logo-grid">`. This reusable two-column layout removes text-link
decoration; HTML links do not add external-link arrows. Use `class="logo-wide"`
on a link to span both columns. Include meaningful image alt text and, when
opening a new tab, `target="_blank" rel="noreferrer"`. Kattenburg's `CREDITS.md`
contains a complete example.

## Interface text

English defaults, including accessibility labels and image viewer controls, live
in `apps/slides/src/lib/shared/interface-settings.ts`. Override any key under
`interface.text` in your content repository. Keep the named placeholders:

```yaml
interface:
  text:
    chapters: Hoofdstukken
    mapLayers: Kaarten
    chapterPosition: "Hoofdstuk {current} van {total}"
    backToTitle: "Terug naar {title}"
    readMore: Lees meer
```

Unspecified keys use English. Existing `interface.startScreen` settings remain
supported; `interface.text` takes precedence. Kattenburg Atlas includes the full
Dutch translation in its `slides.config.yml`.

## Development and derivatives

Vite reads and watches original Markdown, configuration and assets. Additions,
renames and deletions refresh the site. Configuration edits restart Vite;
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
IIIF catalogs are shared between those modes. All generated runner files and symlinks live in the
consumer's cache, never in the installed application.

Linux thumbnail generation requires graphics libraries and Xvfb; see the
[renderer setup](../static-render/README.md). `dev`, `validate` and `check` do
not start native rendering. `SLIDES_THUMBNAILS_ENABLED=false` skips thumbnails
during builds. Remote map sources still need their usual credentials/network.

## Module boundaries

| Export | Purpose |
| --- | --- |
| `/model` and `/model/*` | Schemas, data-only project and shared map decisions; no file watching or native startup. |
| `/content` | Discover and validate a content directory. |
| `/build` | `loadSlidesConfig`, `buildSite`, `runSite`, `buildThumbnails`. |
| `/build/catalog` | Read completed thumbnail manifests. |
| `/vite` | `slidesContent()` adapter for the bundled application. |

```js
import { loadSlidesConfig, buildSite } from '@allmaps/slides/build';
import { loadContent } from '@allmaps/slides/content';

const config = await loadSlidesConfig({ content: './my-story' });
const content = await loadContent(config);
console.log(content.project.title);
await buildSite({ content: './my-story', outDir: './public-site' });
```

Browser code should import the model entry points, keeping Node-only build
dependencies outside the client graph. Workspace exports point to source;
release exports point to compiled JavaScript and declarations. The independent
IIIF, map renderer and Svelte viewer packages can be used without Slides.

## Verification

```sh
pnpm --filter @allmaps/slides test
pnpm --filter @allmaps/slides check
pnpm --filter @allmaps/slides test:dev
pnpm --filter @allmaps/slides test:package
```

The dev smoke runs two independent sites and observes actual HTTP/WebSocket
updates. The package smoke installs archives in a fresh content-only repository
and builds a self-contained local map/image fixture, including native rendering.

The app keeps controls inside iOS safe-area insets in portrait and landscape.
An Apple touch icon derived from the favicon is included for Home Screen installs.
The generated `manifest.webmanifest` uses the main slideshow title and scopes
navigation to the deployment's base path, including every subslideshow. It opens
the main slideshow in standalone mode. Installed apps fill the viewport while
only the reading panels scroll. After deploying changes to installation metadata,
remove and re-add the Home Screen shortcut to test with fresh settings. Links to
external sites can still open an iOS browser sheet.
