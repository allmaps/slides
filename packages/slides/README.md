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

## Credits and navigation

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
and menus for maps, chapters, theme and panel visibility. At 1536px, the reading
panel widens from 480px to 600px and the navigator moves to its left at 480px wide.
A subslideshow begins with its title and a back arrow above the first chapter,
inside the scroll. Footer actions return to the main slideshow or, on the right,
to the top. Chapter map badges
open the map layers panel. On mobile, drag the handle between full, half-height
and hidden positions; when hidden, the handle sits above the chapter count
inside the navigator, and the progress bar is hidden. Tapping the handle also
animates the text panel open.
When the text panel is hidden or the navigator sits outside it, the maps,
chapters and credits overlays open above the navigator. Opening these overlays
does not change the map padding.

Keyboard shortcuts: **Left / Right** for previous / next chapter, **B** to return
to the main slideshow and **H** to hide / show the sidebar. Shortcuts leave text
entry, modified browser shortcuts and image dialogs alone. The mobile handle also
supports **Up / Down**, **Home** (hide) and **End** (expand).

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

Dev generates local IIIF derivatives when requested. Map thumbnails use the
last successful batch. Run `slides thumbnails .` explicitly to refresh them;
the dev server reloads when that batch completes. Production builds prepare
thumbnails and IIIF before exporting the application.

The Vite cache defaults to `node_modules/.vite`. Derivatives and remote inputs
live under its `slides` directory. Each real content root, selected config and
deployment URL has its own application workspace and catalogs. Development and
production have separate SvelteKit output. Completed thumbnail manifests are
shared between those modes. All generated runner files and symlinks live in the
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
