# Allmaps Slides

Application to create map stories using MapLibre, Protomaps and Allmaps.

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Developing

This repository separates content, build tooling and the application:

| Location | Role |
| --- | --- |
| `packages/slides` | Public `@allmaps/slides` CLI, content loader, model, build orchestration and Vite integration. |
| `apps/slides` | SvelteKit presentation, routes and interaction. Included in the published Slides package. |
| `packages/iiif` | Reusable `@allmaps/iiif` image generation, explicit catalogs and optional Vite integration. |
| `packages/static-render` | Framework-independent map rendering from a serializable scene plan. |
| `packages/svelte-canvas-panel` | Reusable Svelte IIIF figure and zoom modal. |
| `content/*` | Independent sites: configuration, Markdown and assets. No JavaScript entry point required. |

The selected directory contains one project. Its `slides.config.yml` holds
metadata, slideshow definitions, sources and application settings. See the
[CLI documentation](packages/slides/README.md) for external installation and
[architecture](docs/architecture.md) for the data flow and cache contracts.

Each slideshow can define a start-screen map using the same map fields as slide
frontmatter. When `start` is omitted, the start screen uses the first slide's map
settings:

```yml
slideshows:
  - id: main
    path: slideshows/00-main
    title: Gravity Expeditions at Sea
    start:
      location:
        center: [4.9, 52.37]
        zoom: 11
      warpedMaps:
        - url: https://annotations.allmaps.org/maps/example
```

Start-screen text can be translated from the project configuration. Use
`{count}` where the number of chapters should appear:

```yml
interface:
  startScreen:
    startButton: Start
    chapterCountSingular: "{count} hoofdstuk in deze presentatie"
    chapterCountPlural: "{count} hoofdstukken in deze presentatie"
    madeWith: Gemaakt met
```

Gravity at Sea and Kattenburg Atlas are Git submodules. Use Node 24 and pnpm 10,
initialize the content repositories, then install dependencies and select a site:

```sh
git submodule update --init --recursive
pnpm install
pnpm exec slides dev ./content/gravity-at-sea
pnpm exec slides dev ./content/kattenburg-atlas --port 5174
pnpm exec slides check ./content/kattenburg-atlas
pnpm exec slides validate ./content/gravity-at-sea
```

Local test content can live in the ignored `content/tests/` directory. If present,
run it with `pnpm exec slides dev ./content/tests --port 5175`.

Each server reads its original content files. Vite watches configuration,
Markdown and assets, including additions, renames and removals. Separate sites
have isolated application caches; they can run concurrently. Package-name
selection remains supported when the content directory has a named
`package.json`, but a package manifest is optional.

```text
content/my-story/
  slides.config.yml
  slideshows/
  assets/
```

Map previews and local IIIF images use their last completed batches. Refresh
them explicitly; a running dev server reloads when each batch completes:

```sh
pnpm exec slides thumbnails ./content/kattenburg-atlas
pnpm exec slides iiif ./content/kattenburg-atlas
```

Page requests never generate images. Run the IIIF command before viewing local
images for the first time, and again after adding, replacing or deleting source
images. Unchanged derivatives are reused from the cache.

## Building

```sh
pnpm exec slides build ./content/kattenburg-atlas
pnpm exec slides preview ./content/kattenburg-atlas
# Select an explicit output or configuration:
pnpm exec slides build ./content/gravity-at-sea --outDir dist/gravity \
  --config ./content/gravity-at-sea/slides.config.yml
```

Output defaults to `<content>/dist`; `--outDir` is relative to the current
working directory. Builds generate map thumbnails and IIIF derivatives before
SvelteKit exports the static site. On Linux, install the renderer's system
libraries and run builds under Xvfb; see [native setup](packages/static-render/README.md).

`pnpm dev`, `pnpm build`, `pnpm check` and `pnpm preview` select Gravity at Sea.
Tests are available with `pnpm -r test`, `pnpm --filter @allmaps/slides test:dev`
and `pnpm --filter @allmaps/slides test:package`. The latter creates a fresh
consumer and checks packed releases, native pixels, IIIF and static output.

### Search metadata

Each slideshow's prerendered HTML includes a canonical URL, social metadata,
and schema.org JSON-LD describing a `WebPage` and its
`PresentationDigitalDocument`. The presentation's `hasPart` entries describe
the chapters as `CreativeWork` sections, with titles, available descriptions,
one-based positions, and links to their HTML anchors. Subslideshows also include
a `BreadcrumbList` back to the project. Metadata updates on client navigation.

URLs use the complete `site.publicUrl` (or the build-time `PUBLIC_URL` override),
including its subpath. For example, `https://example.org/atlas/` produces
`https://example.org/atlas/history` for the `history` slideshow. A trailing slash
on the configured URL is optional. These remain deployment URLs when previewing
on localhost, even if the local router runs at `/`. Set `PUBLIC_URL` to the local
server URL to explicitly preview local metadata instead. `PUBLIC_BASE_PATH`
controls where the app itself is served; it does not change the metadata URL.
An absolute HTTP(S) public URL is required for canonical links and JSON-LD. Slideshow
descriptions take precedence over first-slide and project descriptions. Existing
social thumbnails are reused; no additional rendering is needed.

The contents menu is included in the initial HTML, including collapsed entries,
and chapter navigation uses ordinary links with descriptive text. This helps
crawlers discover the same sections readers can open.

Google [chooses sitelinks automatically](https://developers.google.com/search/docs/appearance/sitelinks);
this markup cannot guarantee a chapter overview in a search result. Its
[ItemList carousels](https://developers.google.com/search/docs/appearance/structured-data/carousel)
support specific content types, not general slideshows. The
[schema.org validator](https://validator.schema.org/) can check the full graph;
Google's [Rich Results Test](https://search.google.com/test/rich-results) checks
only Google-supported features, such as breadcrumbs. After deployment, use
Search Console URL Inspection to check the indexed page and request recrawling.

## Routing

The main slideshow is served at `/`. Other slideshows are served at
`/:slideshow`.

## Config

`content/gravity-at-sea/slides.config.yml` supports environment placeholders,
which is useful for GitHub Pages base paths and public API keys:

```yml
title: Gravity Expeditions at Sea
main: main
slideshows:
  - id: main
    path: slideshows/00-main

site:
  basePath: ${SLIDES_BASE_PATH}
  publicUrl: ${SLIDES_PUBLIC_URL}
protomaps:
  key: ${PUBLIC_PROTOMAPS_KEY}
```

Generated sites in `content/*/dist` and caches in `node_modules/.vite/slides`
are ignored by git.

## Images and captions

Use ordinary HTML figures in Markdown; no component imports are needed. For an
Image API service, use `data-image` with its base URL or `info.json` URL:

```md
<figure data-image="https://example.org/iiif/ship"
  aria-label="A ship on the slipway">

<figcaption>

*Launching a ship*, circa 1900. Collection of
[Het Scheepvaartmuseum](https://www.hetscheepvaartmuseum.nl/collectie).

</figcaption>
</figure>
```

For a Presentation API 2 or 3 manifest, use `data-manifest`. The **first canvas**
is used unless `data-canvas` supplies a canvas ID from that manifest:

```md
<figure data-manifest="https://example.org/manifest.json"
  data-canvas="https://example.org/canvas/2" aria-label="A ship on the slipway">

<figcaption>

*Launching a ship*. [Source institution](https://example.org/object/123).

</figcaption>
</figure>
```

IIIF figures contain the caption and source attributes; do not add a second
Markdown image. Atlas loads the image directly, without a separate fallback or
generated `srcset`. Use `aria-label` on the figure to describe the image (or the
caption is used). Keep blank lines around Markdown inside HTML, and do
not indent it by four spaces. Captions support links, emphasis and paragraphs.
Prefer institution object-record links and retain attribution and rights.

## Callouts

Use a semantic `aside` with the `callout` class. Keep blank lines around
Markdown content inside the HTML element so links, emphasis, and other Markdown
continue to work:

```md
<aside class="callout">

<h2>About this story</h2>

This short note can include [links](https://example.org) and *emphasis*.

</aside>
```

The heading and body follow the green callout style used in the slide design.

For **local derivatives**, a standalone Markdown image is enough. Its relative
asset path resolves to the existing local IIIF service, and its alt text supplies
the label and caption:

```md
![A ship on the slipway](assets/images/ship.jpg)
```

Use a figure for a rich caption:

```md
<figure data-image="assets/images/ship.jpg" aria-label="A ship on the slipway">

<figcaption>

*Launching a ship*. [Source institution](https://example.org/object/123).

</figcaption>
</figure>
```

External IIIF resources require a figure with `data-image` or `data-manifest`.
An ordinary external Markdown image stays an `<img>` with its alt text as the
caption; its URL does not automatically activate the viewer. Images inside a
sentence remain inline. IIIF `info.json` URLs belong in `data-image`, not Markdown
image markup. Unrotated Image API request URLs, including rectangular crops,
are also accepted in `data-image`.

### Image regions

Append a standard `#xywh=x,y,width,height` fragment to `data-image` to crop the
preview and set the modal's opening view. Coordinates refer to the original
image, not its preview size. For example, this selects the photograph within its
card mount in the Pantserplaten slide:

```md
<figure data-image="https://dlc.services/iiif-img/v3/7/6/1e430d74-d9e8-4073-ba9b-438ac4d0988c#xywh=1718,1276,5820,4409"
  aria-label="Railway bridge">

<figcaption>

Piet Oosterhuis, 1875. [TU Delft Library](https://heritage.tudelft.nl/nl/objects/trg-9301-c-01).

</figcaption>
</figure>
```

You can also set `data-region="1700,1200,5900,4550"` on the figure. This takes
precedence over a URL fragment. `percent:10,20,60,50` specifies percentages;
Image API request URLs with `/x,y,width,height/…` or `/pct:x,y,width,height/…`
also supply the region automatically when used in `data-image`.

For local derivatives, use e.g. `data-image="assets/images/ship.jpg"` with
`data-region="100,200,800,600"`. Atlas composes the crop from the available
level 0 tiles; no new crop derivatives are needed. With Presentation manifests,
use `data-canvas="https://example.org/canvas/2#xywh=100,200,800,600"` or put
the fragment on `data-manifest` for the first canvas. These coordinates refer to
the canvas. Regions extending past the image edge are clipped; empty or invalid
regions report a loading error with a retry button.

All figures fetch metadata when the page mounts, reserving the correct proportions
before readers reach them. Atlas and image pixels start loading one reading-panel
height above or below the viewport. The preload distance updates when the panel
resizes. Reserved areas update immediately as dimensions become known.
Thumbnail preloading is off in Slides.
The Atlas module is shared across figures. A Svelte component renders Atlas in
non-interactive mode in the story; activating the image opens a zoomable modal with
zoom controls and a caption overlay containing the same source links.
IIIF images require JavaScript; their authored captions remain available without it.
The modal starts at the preview region and allows zooming out to the complete
image. Escape or the close button dismisses it and restores focus. `+` and `-`
zoom; `Home` or `0` fits the complete image. Slides disables the component's download
buttons and View Transition API; opening and closing move the same canvas
immediately between the story and modal. Atlas's context-menu handler remains
active in the non-interactive preview; zoom/pan listeners are limited to the modal.

The interface disables double-tap page zoom while allowing page panning and pinch
zoom. Map and image viewers keep their own gesture handling. The light/dark toggle
also updates the browser's `theme-color`, page background and `color-scheme`, using
the same saved preference as the interface.

IIIF metadata is resolved **in the browser** using `@iiif/helpers`, and Atlas
loads the image tiles; remote services must support CORS. There is no remote fetch or disk cache in the Markdown
preprocessor. This does not mirror external images, manifests or maps: importing
those into the content package is a separate, future CLI feature.

Run Markdown regression tests with `pnpm --filter @allmaps/slides-app test`, and
viewer tests with `pnpm --filter @allmaps/svelte-canvas-panel test`.

### Viewer package

Slides imports `CanvasPanel` from `@allmaps/svelte-canvas-panel` through `workspace:*`.
The [package README](packages/svelte-canvas-panel/README.md) documents its Svelte API,
styling, tests and packaging commands. Workspace imports use the source, so viewer
edits participate in the normal Slides development server without a separate build.
Packed releases contain preprocessed components, JavaScript and type declarations.

The package owns IIIF parsing, Atlas rendering, the modal, downloads, transitions
and interactive listener cleanup. Slides owns Markdown transformation, content
asset URL resolution and the reading-panel preload observer. Its small
`CanvasFigure.svelte` adapter passes the authored caption as a Svelte snippet and
maps the app's theme variables onto the component's CSS variables. Use
`data-rotation="90"` on a figure for clockwise rotation, including
local level 0 derivatives; `data-region` continues to use unrotated coordinates.

The viewer pins the published Atlas **3.2.4** standalone entry. It needs no custom
Atlas build, submodule or workspace dependency override. Atlas declares unused React
peers, which package managers may install; those adapters are never imported or
included in the viewer bundle.

Presentation support covers painting images and rectangular canvas placement.
Painting-annotation source crop selectors, nonrectangular targets and audiovisual playback
are outside this figure viewer's scope; unsupported figures show a loading error.

Use the existing `slides dev`, `slides check` and `slides build` commands. For
the local Kattenburg package, run `pnpm exec slides dev ./content/kattenburg-atlas`.
