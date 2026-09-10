<script lang="ts">
  import { CanvasPanel, type CanvasPanelProps } from "@allmaps/svelte-canvas-panel";
  import type { Readable } from "svelte/store";

  let { source, label, caption: captionHtml, loadImage }: {
    source: CanvasPanelProps; label: string; caption: string; loadImage: Readable<boolean>;
  } = $props();
</script>

{#snippet captionContent()}
  <!-- HTML comes from the already-rendered, authored Markdown caption. -->
  {@html captionHtml}
{/snippet}

<CanvasPanel {...source} {label} embedded caption={captionHtml ? captionContent : undefined}
  loadImage={$loadImage} enableDownloads={false} enableViewTransitions={false}
  --canvas-panel-control-bg="var(--app-map-control-bg)"
  --canvas-panel-control-color="var(--app-map-control-text)"
  --canvas-panel-font-family="var(--font-body)" />
