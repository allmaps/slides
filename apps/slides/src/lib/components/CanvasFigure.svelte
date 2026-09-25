<script lang="ts">
  import { CanvasPanel, type CanvasPanelProps } from "@allmaps/svelte-canvas-panel";
  import type { Readable } from "svelte/store";

  import type { InterfaceText } from "$lib/shared/interface-settings";
  let { source, label, t, caption: captionHtml, loadImage }: {
    t: InterfaceText; source: CanvasPanelProps; label: string; caption: string; loadImage: Readable<boolean>;
  } = $props();
</script>

{#snippet captionContent()}
  <!-- HTML comes from the already-rendered, authored Markdown caption. -->
  {@html captionHtml}
{/snippet}

<CanvasPanel {...source} {label} embedded caption={captionHtml ? captionContent : undefined}
  text={Object.fromEntries(["image", "enlargeImage", "openImage", "imageZoom", "zoomIn", "zoomOut", "closeImage", "loadingImage", "imageLoadError", "tryAgain", "downloadPreview", "downloadView", "previewDownloadError", "viewDownloadError"].map(key => [key, t(key === "openImage" ? "open" : key === "closeImage" ? "close" : key as Parameters<InterfaceText>[0])]))}
  loadImage={$loadImage} enableDownloads={false} enableViewTransitions={false}
  --canvas-panel-control-bg="var(--app-map-control-bg)"
  --canvas-panel-control-color="var(--app-map-control-text)"
  --canvas-panel-font-family="var(--font-body)" />
