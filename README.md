# Allmaps Slides

Application to create map stories using MapLibre, Protomaps and Allmaps.

## Inspired by

- [Reuzenarbeid](https://tu-delft-heritage.github.io/reuzenarbeid/)
- [City Atlas](https://cityatlas.theberlage.nl/)
- [Interactive Storytelling with MapLibre](https://github.com/digidem/maplibre-storymap/)

## Developing

This repository is a pnpm workspace:

- `apps/slides` contains the SvelteKit application.
- [`packages/svelte-canvas-panel`](packages/svelte-canvas-panel/README.md) contains
  the reusable Svelte IIIF figure and zoom modal.
- `packages/sveltekit-iiif` generates and serves local IIIF derivatives.
- `content/gravity-at-sea` is the `@allmaps/gravity-at-sea` workspace package.
  It exports the Gravity at Sea markdown, config, and assets.
- `packages/cli` validates content and starts/builds the app.
- `packages/slides-content` is the stable app import target. The CLI aliases it
  to the selected content package when it starts the app.

The selected content package contains one project. Its `slides.config.yml` holds
the project metadata, slideshow definitions, sources, and application settings.

Install dependencies with `pnpm install`, start a development server:

```sh
pnpm run dev

# or start the server and open the app in a new browser tab
pnpm run dev -- --open
```

During development, the app imports content directly from
`@allmaps/slides-content`, a stable package name. The CLI resolves the selected
content package, aliases `@allmaps/slides-content` to that package's entry
point, watches the selected package root, and reports validation errors. It no
longer copies markdown or assets into the app.

The content package has a small entry point:

```txt
content/
  gravity-at-sea/
    package.json
    index.ts
    slides.config.yml
    slideshows/
    assets/
```

`content/gravity-at-sea/index.ts` exports Vite glob imports for the config,
markdown slides, and assets. Asset paths in markdown/frontmatter are resolved
relative to the content package root.

## Building

To create a production version of your app:

```sh
pnpm run build
```

You can preview the production build with `pnpm run preview`.

Use another config file by calling the CLI directly:

```sh
pnpm exec slides build @allmaps/gravity-at-sea --config content/gravity-at-sea/slides.production.yml
```

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

Generated folders such as `apps/slides/build` and SvelteKit/Vite caches are
ignored by git.

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

Run Markdown regression tests with `pnpm --filter @allmaps/slides test`, and
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
the local Kattenburg package, run `pnpm exec slides dev kattenburg-atlas`.
