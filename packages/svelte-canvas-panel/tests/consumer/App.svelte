<script lang="ts">
  import { CanvasPanel, type CanvasPanelProps } from '@allmaps/svelte-canvas-panel';

  let visible = $state(true);
  let visibilityRatio = $state(0.8);
  let source = $state<CanvasPanelProps>({ manifest: '/manifest.json' });
  let rotation = $state(0);
  let loadImage = $state(false);
  let preloadThumbnail = $state(false);
  let features = $state(false);
  let height = $state<number>();
</script>

<button onclick={() => visible = !visible}>Toggle figure</button>
<button onclick={() => visibilityRatio = visibilityRatio === 0.8 ? 1 : 0.8}>Toggle pan tolerance</button>
<button onclick={() => source = { imageService: '/image/info.json', region: '20,10,200,100' }}>Use image region</button>
<button onclick={() => rotation = (rotation + 90) % 360}>Rotate image</button>
<button onclick={() => loadImage = true}>Load image</button>
<button onclick={() => preloadThumbnail = !preloadThumbnail}>Preload thumbnail</button>
<button onclick={() => features = !features}>Toggle downloads and transitions</button>
<button onclick={() => height = height ? undefined : 240}>Toggle fixed height</button>
<div style="max-width: 600px">
  {#if visible}
    <CanvasPanel {...source} {rotation} {height} {loadImage} {preloadThumbnail} runtimeOptions={{ visibilityRatio }}
      enableDownloads={features} enableViewTransitions={features} label="Package test image">
      {#snippet caption()}
        A <em>rich caption</em> with an <a href="https://example.org/object">institution link</a>.
        <button onclick={() => rotation += 360}>Turn full circle</button>
        <button onclick={() => loadImage = false}>Defer image</button>
      {/snippet}
    </CanvasPanel>
  {/if}
</div>
