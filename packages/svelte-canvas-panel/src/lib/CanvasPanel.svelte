<script lang="ts">
  import { flushSync, onDestroy, tick } from "svelte";
  import { Download, Maximize, Minus, Plus, X } from "@lucide/svelte";
  import AtlasViewer, { type ImageControls } from "./AtlasViewer.svelte";
  import type { IiifResource } from "./iiif-resource.ts";
  import { canvasRotation } from "./rotation.ts";
  import { thumbnailUrl } from "./image-url.ts";
  import type { CanvasPanelProps } from "./types.ts";
  import type { IiifSource } from "./iiif-source.ts";

  let { manifest, startCanvas, imageService, region, label = "Image", caption, text = {},
    embedded = false, height, rotation = 0, runtimeOptions,
    enableDownloads = true, enableViewTransitions = true,
    loadImage = true, preloadThumbnail = false, onLayoutReady }: CanvasPanelProps = $props();
  const ui = $derived({
    enlargeImage: 'Enlarge image: {title}', openImage: 'Open image viewer: {title}', imageZoom: 'Image zoom',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', closeImage: 'Close image', loadingImage: 'Loading image…',
    imageLoadError: 'The IIIF image could not be loaded.', tryAgain: 'Try again',
    downloadPreview: 'Download image preview', downloadView: 'Download image view',
    previewDownloadError: 'The image preview could not be downloaded.', viewDownloadError: 'The image view could not be downloaded.', ...text,
  });
  const source = $derived<IiifSource>(manifest
    ? { type: "manifest", url: manifest, canvas: startCanvas, region }
    : { type: "image", url: imageService ?? "", region });
  let ready = $state(false);
  let error = $state(false);
  let downloadError = $state(false);
  let attempt = $state(0);
  let open = $state(false);
  let transitioning = $state(false);
  let panel = $state<ImageControls>();
  let poster = $state<string>();
  let resource = $state.raw<IiifResource>();
  const view = $derived(resource ? canvasRotation(resource, rotation) : undefined);
  const previewSize = $derived(resource && view
    ? view.bounds(resource.region ?? { x: 0, y: 0, width: resource.width, height: resource.height }) : undefined);
  const thumbnails = $derived(preloadThumbnail && resource
    ? resource.images.map(image => ({ ...image.target, url: thumbnailUrl(image.service) })).filter(image => image.url) : []);
  let thumbnailReady = $state(false);
  const showThumbnail = $derived(thumbnailReady && thumbnails.length > 0);
  let dialog: HTMLDialogElement;
  let zoomPanel = $state<HTMLDivElement>();
  let trigger = $state<HTMLButtonElement>();
  let transition: ViewTransition | undefined;
  let requestedOpen = false;
  let changing = false;
  let disposed = false;

  onDestroy(() => {
    disposed = true;
    transition?.skipTransition();
  });

  $effect(() => {
    const currentSource = source;
    // Closing moves the canvas with flushSync, after this effect has finished.
    queueMicrotask(close);
    void attempt;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]);
    resource = undefined;
    ready = false;
    thumbnailReady = false;
    panel = undefined;
    error = false;
    void import("./iiif-resource.ts")
      .then(({ loadIiifResource }) => loadIiifResource(currentSource, document.baseURI, signal))
      .then((result) => { if (!signal.aborted) resource = result; })
      .catch(() => { if (!controller.signal.aborted) error = true; });
    return () => controller.abort();
  });

  $effect(() => {
    void rotation;
    void loadImage;
    ready = false;
    panel = undefined;
    queueMicrotask(close);
  });

  $effect(() => {
    // Effects run after the aspect ratio has been written to the preview DOM.
    if (previewSize || error) onLayoutReady?.();
  });

  $effect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  });

  function enlarge() {
    if (!ready || open || changing) return;
    poster = panel?.snapshot();
    downloadError = false;
    void changeOpen(true);
  }

  function close() {
    void changeOpen(false);
  }

  async function changeOpen(nextOpen: boolean) {
    requestedOpen = nextOpen;
    if (changing) {
      // Escape can interrupt opening; finish its DOM update before closing.
      transition?.skipTransition();
      return;
    }
    changing = true;
    try {
      while (!disposed && requestedOpen !== open) {
        const expanded = requestedOpen;
        const update = () => {
          if (disposed) return;
          if (expanded) dialog.showModal();
          // Flush the portal move and resize before the new view is captured.
          flushSync(() => { open = expanded; });
          if (!expanded) {
            dialog.close();
            trigger?.focus({ preventScroll: true });
          }
        };
        if (!enableViewTransitions || !document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          update();
          continue;
        }
        // Only this figure gets the shared names, and only during its transition.
        flushSync(() => { transitioning = true; });
        transition = document.startViewTransition(update);
        // A resize, navigation or interruption may skip the animation. The DOM
        // update still runs, and transition names must always be released.
        void transition.ready.catch(() => {});
        try {
          await transition.finished;
        } finally {
          transition = undefined;
          transitioning = false;
          await tick();
        }
      }
    } finally {
      changing = false;
    }
  }

  async function download() {
    downloadError = false;
    try { await panel?.download(); } catch { downloadError = true; }
  }
</script>

<svelte:element this={embedded ? "div" : "figure"} class="canvas-panel" aria-label={label}>
<div class="preview" aria-busy={!ready && !error}>
  <div class="preview-panel" class:visible={ready || showThumbnail} inert={!ready} style:height={height ? `${height}px` : undefined} style:aspect-ratio={previewSize ? `${previewSize.width} / ${previewSize.height}` : undefined}>
    {#if previewSize && thumbnails.length && !ready}
      <svg class="thumbnail" viewBox={`${previewSize.x} ${previewSize.y} ${previewSize.width} ${previewSize.height}`} aria-hidden="true">
        <g transform={view?.transform}>
          {#each thumbnails as image}
            <image href={image.url} x={image.x} y={image.y} width={image.width} height={image.height} onload={() => { thumbnailReady = true; }} />
          {/each}
        </g>
      </svg>
    {/if}
    {#key `${attempt}:${rotation}`}
      {#if resource && loadImage}
        <AtlasViewer {resource} {label} enlargeLabel={ui.enlargeImage.replaceAll("{title}", label)} {transitioning} {rotation} {runtimeOptions} target={open ? zoomPanel : undefined} onactivate={enlarge}
          onready={(controls) => { panel = controls; ready = true; error = false; }}
          onerror={() => { error = true; }} />
      {/if}
    {/key}
  </div>
  {#if open && poster}<img class="poster" src={poster} alt={label} />{/if}
  {#if ready}
    <div class="preview-controls">
      {#if enableDownloads}<button type="button" class="image-control" aria-label={ui.downloadPreview} onclick={download}><Download size={20} /></button>{/if}
      <button type="button" class="image-control expand-control" bind:this={trigger} aria-label={ui.openImage.replaceAll("{title}", label)} onclick={enlarge}><Maximize size={20} /></button>
    </div>
  {:else if !error && !showThumbnail}
    <p class="status" role="status">{ui.loadingImage}</p>
  {/if}
</div>
{#if error}
  <p class="load-error" role="status">
    {ui.imageLoadError}
    <button type="button" onclick={() => { error = false; attempt += 1; }}>{ui.tryAgain}</button>
  </p>
{/if}
{#if downloadError && !open}<p class="load-error" role="status">{ui.previewDownloadError}</p>{/if}
{#if caption && !embedded}<figcaption class="inline-caption">{@render caption()}</figcaption>{/if}

<!-- Native dialog supplies focus containment, Escape and top-layer rendering. -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialog} class="image-dialog" aria-label={label} onclose={() => { if (open) close(); }}
  oncancel={(event) => { event.preventDefault(); close(); }}
  onclick={(event) => { if (event.target === dialog) close(); }}>
  <div class="zoom-panel" bind:this={zoomPanel}></div>
  {#if open}
    <div class="toolbar" style:view-transition-name={transitioning ? "canvas-panel-image-controls" : "none"}>
      <div class="zoom-controls" role="group" aria-label={ui.imageZoom}>
        <button type="button" class="image-control" aria-label={ui.zoomIn} onclick={() => panel?.zoomIn()}><Plus size={22} /></button>
        <button type="button" class="image-control" aria-label={ui.zoomOut} onclick={() => panel?.zoomOut()}><Minus size={22} /></button>
        {#if enableDownloads}<button type="button" class="image-control" aria-label={ui.downloadView} onclick={download}><Download size={22} /></button>{/if}
      </div>
      <button type="button" class="image-control" aria-label={ui.closeImage} onclick={close}><X size={24} /></button>
    </div>
    {#if downloadError}<p class="modal-status" role="status">{ui.viewDownloadError}</p>{/if}
    {#if caption}
      <div class="caption-overlay" style:view-transition-name={transitioning ? "canvas-panel-image-caption" : "none"}>
        <div class="modal-caption">{@render caption()}</div>
      </div>
    {/if}
  {/if}
</dialog>
</svelte:element>

<style>
  .canvas-panel, .image-dialog { touch-action: manipulation; }
  .canvas-panel { margin: 0; width: 100%; font-family: var(--canvas-panel-font-family, inherit); }
  .inline-caption { margin-top: 0.75rem; font-size: 0.9em; line-height: 1.4; }
  .inline-caption :global(:first-child) { margin-top: 0; }
  .inline-caption :global(:last-child) { margin-bottom: 0; }
  button { box-sizing: border-box; font: inherit; }
  :global(::view-transition-group(canvas-panel-image)) {
    z-index: 1;
    animation-duration: 320ms;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }
  :global(::view-transition-old(canvas-panel-image)), :global(::view-transition-new(canvas-panel-image)) {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  :global(::view-transition-group(canvas-panel-image-controls)), :global(::view-transition-group(canvas-panel-image-caption)) {
    z-index: 2;
    animation-duration: 200ms;
  }
  @media (prefers-reduced-motion: reduce) {
    :global(::view-transition-group(canvas-panel-image)),
    :global(::view-transition-group(canvas-panel-image-controls)), :global(::view-transition-group(canvas-panel-image-caption)) {
      animation-duration: 0s;
    }
  }
  .preview { position: relative; width: 100%; }
  .preview-panel { position: relative; width: 100%; aspect-ratio: 3 / 2; opacity: 0; }
  .preview-panel.visible { opacity: 1; }
  .thumbnail { position: absolute; inset: 0; width: 100%; height: 100%; }
  .poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
  .preview-controls { position: absolute; right: 0.5rem; bottom: 0.5rem; display: flex; gap: 0.4rem; }
  .image-control { display: grid; place-items: center; width: 52px; height: 52px; border: 0; border-radius: 0.5rem; background: var(--canvas-panel-control-bg, rgb(18 26 28 / 0.65)); color: var(--canvas-panel-control-color, #fff); box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); backdrop-filter: blur(12px); cursor: pointer; pointer-events: auto; }
  .image-control:hover { background: var(--canvas-panel-control-hover-bg, rgb(18 26 28 / 0.3)); }
  .image-control:focus-visible { outline: 2px solid currentColor; outline-offset: 3px; }
  .expand-control:focus { outline: none; }
  .expand-control:focus-visible { background: var(--canvas-panel-control-hover-bg, rgb(18 26 28 / 0.3)); }
  .status { position: absolute; inset: 0; margin: 0; display: grid; place-items: center; font-size: 0.85em; }
  .load-error { font-size: 0.85em; }
  .load-error button { border: 0; padding: 0; background: none; color: inherit; text-decoration: underline; cursor: pointer; }
  .image-dialog { box-sizing: border-box; position: fixed; inset: 0; margin: auto; width: calc(100vw - 2rem); max-width: none; height: calc(100dvh - 2rem); max-height: none; padding: 0; border: 1px solid rgb(255 255 255 / 0.2); border-radius: 0.5rem; outline: none; overflow: hidden; color: #fff; background: var(--canvas-panel-modal-bg, #24292d); }
  .image-dialog::backdrop { background: rgb(18 26 28 / 0.55); backdrop-filter: blur(4px); }
  .zoom-panel { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
  .toolbar { position: absolute; top: 1rem; left: 1rem; right: 1rem; display: flex; align-items: start; justify-content: space-between; pointer-events: none; z-index: 2; }
  .zoom-controls { display: flex; gap: 0.4rem; }
  .caption-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 3rem 1.5rem 1.25rem; background: linear-gradient(transparent, #101315ed); pointer-events: none; z-index: 1; }
  .modal-caption { max-width: 75ch; margin: 0 auto; pointer-events: auto; font-size: 1rem; line-height: 1.4; text-shadow: 0 1px 3px #000; overflow-wrap: anywhere; }
  .modal-caption :global(p) { margin: 0 0 0.5em; }
  .modal-caption :global(:last-child) { margin-bottom: 0; }
  .modal-caption :global(a) { color: #fff; text-decoration: underline; text-underline-offset: 0.15em; }
  .modal-status { position: absolute; top: 5rem; left: 1rem; right: 1rem; text-align: center; pointer-events: none; }
  @media (max-width: 640px) {
    .image-dialog { width: 100vw; height: 100dvh; border: 0; border-radius: 0; }
    .toolbar { top: max(0.75rem, env(safe-area-inset-top)); left: 0.75rem; right: 0.75rem; }
    .caption-overlay { padding: 2.5rem 1rem max(1rem, env(safe-area-inset-bottom)); }
    .modal-caption { font-size: 0.9rem; }
  }
</style>
