# @allmaps/svelte-canvas-panel

A Svelte 5 canvas panel with a non-interactive preview, rich captions and a zoomable
modal. It uses the published Atlas 3.2.4 standalone viewer and IIIF Commons helpers.
It works in Svelte and SvelteKit without app aliases, Tailwind or a Markdown processor.

The public exports are `CanvasPanel` and the TypeScript type `CanvasPanelProps`.
The API follows [React IIIF Vault's CanvasPanel](https://github.com/digirati-co-uk/react-iiif-vault/blob/main/src/canvas-panel/index.tsx)
for `manifest`, `startCanvas`, `height`, `rotation` and `runtimeOptions`. This is a
limited Svelte component, not a drop-in implementation of every upstream feature:
no paging, ranges, editing, media controls, annotations UI or React providers.

## Usage

```svelte
<script lang="ts">
  import { CanvasPanel } from '@allmaps/svelte-canvas-panel';
</script>

<CanvasPanel
  manifest="https://example.org/manifest.json"
  startCanvas="https://example.org/canvas/2"
  label="A drawing of the shipyard"
  runtimeOptions={{ visibilityRatio: 0.8 }}
>
  {#snippet caption()}
    A drawing of the shipyard. Collection of
    <a href="https://example.org/object">the source institution</a>.
  {/snippet}
</CanvasPanel>

<!-- Image API, including local level 0 derivatives -->
<CanvasPanel imageService="/iiif/photo/info.json" region="100,200,800,600" rotation={90} />
```

Choose either `manifest` or `imageService`. A manifest uses the first canvas unless
`startCanvas` selects another. The caption snippet appears in a `figcaption` below
the preview and in the modal overlay. Pass caption content without a surrounding
`figcaption`; sanitizing HTML passed through `{@html}` remains the caller's responsibility.

## Props

| Prop | Default | Meaning |
| --- | --- | --- |
| `manifest` | — | Presentation API 2 or 3 manifest URL; alternative to `imageService`. |
| `startCanvas` | First canvas | Canvas ID within the manifest. |
| `imageService` | — | Image API service base, `info.json` URL or an unrotated image request URL. |
| `region` | Complete canvas | Initial pixel or percentage xywh region, in original unrotated coordinates. |
| `rotation` | `0` | Clockwise degrees, normalized to 0–360. Rotates pixels in Atlas, without requiring server rotation support. |
| `height` | Automatic ratio | Preview height in CSS pixels; modal fills its dialog. |
| `runtimeOptions` | See below | Supported Atlas zoom/pan settings; updates while mounted. |
| `label` | `Image` | Accessible description and download filename basis. |
| `caption` | — | Svelte snippet shared by the preview and modal. |
| `embedded` | `false` | Render a `div` inside an existing figure, omitting the inline caption. |
| `enableDownloads` | `true` | Show buttons that save the rendered preview/modal view as PNG. |
| `enableViewTransitions` | `true` | Animate opening/closing with the View Transition API when available. |
| `loadImage` | `true` | Mount Atlas and request image pixels. Metadata always loads immediately. |
| `preloadThumbnail` | `false` | Fetch a small service image while waiting for Atlas, even with `loadImage={false}`. |
| `onLayoutReady` | — | Called after metadata settles and preview dimensions are applied, including on failure. Use before scrolling to content; does not wait for image pixels. |

`runtimeOptions` supports `visibilityRatio` (default `0.8`, clamped to 0–1),
`maxOverZoom` and `maxUnderZoom` (both default `1`, positive numbers). A lower
visibility ratio allows more panning beyond the image edge before correction.
Other Atlas runtime options are intentionally not exposed.

Relative URLs resolve against `document.baseURI`. `#xywh=` fragments and crops in
Image API request paths are accepted; explicit `region` wins. Use pixel values
like `100,200,800,600` or `percent:10,20,30,40`. Rotation preserves this selection
and the full image remains accessible in the modal. Changing rotation rebuilds
the Atlas world but reuses the already loaded metadata and browser image cache.

Painting images, linked annotation pages and rectangular canvas placement are
supported. Painting-annotation source crop selectors, nonrectangular targets and
audiovisual playback are unsupported and show a loading error.

## Metadata, thumbnails and lazy images

Mount all panels at page load with `loadImage={false}` to fetch only their metadata
and establish the correct proportions early. Set `loadImage` to true when your
intersection observer reaches the desired preload distance. No Atlas runtime,
tiles or fallback pixels are fetched for a deferred panel by default. Atlas's
code is shared across mounted panels; each active panel owns its runtime and tiles.

```svelte
<CanvasPanel imageService="/iiif/photo/info.json"
  loadImage={nearViewport}
  enableDownloads={false}
  enableViewTransitions={false}
/>
```

Optionally set `preloadThumbnail` to true. It uses an advertised service size
(preferably at least 320 pixels wide), or a 512-pixel request for services that
support custom sizes. It skips services without a suitable request and ordinary
painting image bodies without a service. This is an explicit extra image request;
it is off by default. The thumbnail uses the same crop/rotation, disappears once
Atlas is ready, and is never layered behind the interactive modal. HTTP caching
can reuse it if Atlas requests the same URL.

SSR reserves the preview area and renders captions without fetching resources or
loading Atlas. Unless you provide `height`, exact proportions become available
after client metadata arrives. The preview container updates its size and visibility
immediately. `enableViewTransitions` only controls the modal animation.
Metadata is fetched per mounted panel, aborted on source changes/unmount, with no persistent cache or
preprocessing CLI. Remote metadata and pixels must support CORS.

## Interaction and styling

The preview and modal share one canvas, runtime and tile cache. Opening enables
interaction; closing removes zoom/pan listeners and restores the initial region.
Atlas's context-menu handler remains active in the non-interactive preview, including
before the first modal opening. It suppresses the browser's native canvas context
menu. Exactly one handler is retained across modal cycles and removed on unmount.
View transitions respect reduced-motion preferences. Escape closes the modal;
`+`/`-` zoom and `Home`/`0` fits the complete rotated canvas. Downloads exclude
controls and captions. The two feature flags can be changed while mounted.

The preview and dialog controls disable double-tap page zoom with
`touch-action: manipulation`. The interactive canvas handles its own zoom/pan
gestures. The preview's expand button uses a background change for keyboard focus
instead of an outline.

Defaults work without application CSS. Override inherited CSS variables on an
ancestor or through Svelte component custom properties:

```svelte
<CanvasPanel imageService="/iiif/photo" label="Shipyard"
  --canvas-panel-control-bg="rgb(18 26 28 / 0.6)"
  --canvas-panel-control-color="white"
  --canvas-panel-font-family="Georgia, serif"
/>
```

| Variable | Default |
| --- | --- |
| `--canvas-panel-control-bg` | `rgb(18 26 28 / 0.65)` |
| `--canvas-panel-control-color` | `#fff` |
| `--canvas-panel-control-hover-bg` | `rgb(18 26 28 / 0.3)` |
| `--canvas-panel-modal-bg` | `#24292d` |
| `--canvas-panel-font-family` | Inherit |

## Development and packaging

From the workspace root:

```sh
pnpm --filter @allmaps/svelte-canvas-panel check
pnpm --filter @allmaps/svelte-canvas-panel test
pnpm --filter @allmaps/svelte-canvas-panel build
pnpm --filter @allmaps/svelte-canvas-panel test:package
pnpm --filter @allmaps/svelte-canvas-panel pack --pack-destination /tmp
```

Workspace exports point to `src/lib` for direct editing and hot reload in Slides.
`pnpm pack` builds the package with `@sveltejs/package` and uses `publishConfig`
to replace those exports with the generated `dist` entry and type declarations.
Use pnpm to pack or publish this package. Generated output is not committed.

`test:package` packs and installs the result in an isolated Svelte/Vite consumer,
checks its types, renders it on the server, and builds its browser bundle. It also
checks that Atlas stays behind dynamic imports and no React or Preact modules
enter that bundle. This test requires registry access for the isolated install. Set
`KEEP_VIEWER_CONSUMER=1` to keep the printed temporary directory; run
`pnpm exec vite preview` there to try its self-contained IIIF fixture in a browser.

The package remains **UNLICENSED** and has not been published.

## Atlas dependency

Atlas is pinned to 3.2.4, using only `@atlas-viewer/atlas/standalone`. No custom Atlas
build, submodule or package-manager overrides are needed. Atlas's metadata declares
unused React peers, which package managers may install; the standalone entry never
imports the React adapters and they are not included in the browser bundle.

The internal `atlas-interaction.ts` helper cancels saved zoom/region commands and
removes interactive frame hooks when returning to the preview. It preserves Atlas's
context-menu behavior separately from zoom/pan interaction, replacing that handler
when recreating the event manager and removing it when the canvas is destroyed.
The regression tests verify repeated modal lifecycles without accumulated listeners.
The world builder also supplies rotated bounds to Atlas’s spatial index so zoomed
image edges are not culled. Review these adaptations when upgrading Atlas. These internals are not public exports.
