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

The current Allmaps packages support Zod 4.6.5 without a package-manager override.
Remove any older `zod: 4.4.3` override when upgrading and update your lockfile.

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

## Overall titles, descriptions and sharing images

An overall `title` or `description` can be a string, or short and long variants:

```yaml
title:
  short: Kattenburg Atlas
  long: Kattenburg Atlas — four centuries of maritime history
description:
  short: A maritime and military microcosm
  long: Explore the history of Kattenburg through maps, images and stories.
```

If only one variant is supplied, it is used for both. Existing strings also
serve both purposes. The app title, start modal and sharing image use the short
text. The overall description takes priority over the main slideshow's
description in the start modal and on the main route. If it is absent, the
main slideshow description remains a fallback.

Page titles, Open Graph/Twitter metadata and structured data use the long
overall text. Subslideshow page titles append the subslideshow title; their
descriptions use the slideshow/first chapter description, falling back to the
long overall description.

Sharing images are separate 1200 × 630 JPEGs, without text by default.
Enable the title/subtitle overlay and optionally adjust its size:

```yaml
socialImage:
  textOverlay: true
  textSize: 76
```

`textOverlay` defaults to `false`. When enabled, the overall short title appears
over the first slide's map scene, with the overall short description below it.
Subslideshow images use the same overall title and the subslideshow title as
their subtitle. `textSize` is the title size in pixels at 1200 × 630 (default:
`76`, greater than zero and at most `512`). The subtitle scales proportionally
(34 pixels at the default size); long text still shrinks to fit.

These settings only affect sharing images; in-app chapter cards, hover previews
and map buttons always omit text. Disabled overlays do not load a font file.

The default sharing font is the app's bundled League Spartan. To use another
font, supply its family name and a local TTF/OTF path relative to the content
directory (outside the IIIF image folder):

```yaml
socialImage:
  textOverlay: true
  font:
    family: My Display Font
    path: assets/fonts/display.ttf
```

Omitting `path` uses a font already installed on the rendering machine; include
the file for consistent local and CI output. Font files are passed to the
generic renderer as inputs, not embedded in its package. A custom app selected
with `app.directory` should provide the default font or configure its own here.

Run `slides thumbnails .` to refresh sharing images, or build the site. Changes
to the text, its size or its font reuse cached map scenes and only regenerate the text
composition and JPEG. Ordinary development edits still do not start rendering.

## Interface colors

Choose an Allmaps palette in `slides.config.yml`:

```yaml
theme: purple
```

Available themes are `green` (the default), `purple`, `red`, `yellow`, `orange`,
`pink` and `blue`. Alternatively, supply both accent colors as quoted, opaque
hex values (`#RGB` or `#RRGGBB`):

```yaml
theme:
  fg: "#c552b5"
  bg: "#e8bae1"
```

`fg` colors links, accents, progress and the Start button; `bg` colors the
navigator and overlays. Hover/selected states blend the pair. In dark mode,
the background is mixed with the app's dark neutral. Overlay icons use the
same neutral color as their text. Start-button text stays white for every theme.

Only these two accent colors are configurable. Reading panels, body text,
muted controls and shadows keep their existing light/dark neutral colors.
The UI palette is independent of `map.theme`, map styles and GeoJSON colors.

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

All slides are included in chapter numbering and totals. The start screen shows
the overall title and description, the Start button and the Allmaps credit.
Chapters start at 1. Sections in one subslideshow use `1.1`, `1.2`,
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
Closing the chapters overlay resets its scroll position and expanded branches;
reopening it expands only the current chapter's branch.
The map button always counts all maps configured for its chapter, including
temporarily hidden maps. Visibility toggles in the layers panel reset when the
active chapter or slideshow changes.
On mobile, swipe left or right across the navigator's arrows and counter to move
to the next or previous chapter. Drag the handle between full, half-height
and collapsed positions. The rounded card keeps a margin above the bottom edge and moves behind the
fixed navigator. When collapsed, only the card's handle
and a border around the navigator remain visible. The progress bar stays visible
in every position. The expanded card stops below the app title, with the same
margin as around the edges. Tapping the handle also animates the card open.
The maps, chapters and credits overlays open above the navigator. Opening them
does not change the map padding. On mobile, all overlays can grow to the
available height below the app title, independently of the text card's height,
including when the card is collapsed. On wide desktop layouts, overlays can use all the space
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
The generated `manifest.webmanifest` uses the overall title and scopes
navigation to the deployment's base path, including every subslideshow. It opens
the main slideshow in standalone mode. Installed apps fill the viewport while
only the reading panels scroll. After deploying changes to installation metadata,
remove and re-add the Home Screen shortcut to test with fresh settings. Links to
external sites can still open an iOS browser sheet.
