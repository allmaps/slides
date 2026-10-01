# @allmaps/svelte-canvas-panel

A Svelte 5 image preview with a zoomable dialog and rich captions.
It accepts IIIF manifests, image services and ordinary images, and works in
SvelteKit without app-specific aliases or styles.

This workspace package is included in `@allmaps/slides` as
`@allmaps/slides/canvas-panel`. No separate installation is needed for Slides.

## Use the component

In a Svelte application with `@allmaps/slides` installed:

```svelte
<script lang="ts">
  import { CanvasPanel } from '@allmaps/slides/canvas-panel';
</script>

<CanvasPanel image="/photos/shipyard.jpg" label="A ship on the slipway">
  {#snippet caption()}
    Launching a ship, circa 1900.
  {/snippet}
</CanvasPanel>
```

Place the image at your application's public `/photos/shipyard.jpg` URL.
Inside this workspace, you can import directly from `@allmaps/svelte-canvas-panel`.
To add images to slideshow Markdown, use [figures and captions](../../docs/images.md).

See the [component reference](../../docs/canvas-panel.md) for IIIF examples,
props, CSS variables, lazy loading and Atlas integration.

## Develop

Run from the repository root:

```sh
pnpm --filter @allmaps/svelte-canvas-panel check
pnpm --filter @allmaps/svelte-canvas-panel test
```

[Packaging checks](../../docs/canvas-panel.md#development-and-packaging)
exercise an isolated Svelte/Vite consumer.
