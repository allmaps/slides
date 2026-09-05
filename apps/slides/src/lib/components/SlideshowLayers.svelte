<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { page } from "$app/state";
  import { env } from "$env/dynamic/public";
  import {
    Eye,
    EyeOff,
    Layers,
    MoveUpRight,
    ScanSearch,
  } from "@lucide/svelte";

  import PanelOverlay from "$lib/components/PanelOverlay.svelte";
  import type { MapChapter, WarpedMapProps } from "$lib/shared/types";

  type Props = {
    chapter?: MapChapter;
    hiddenWarpedMapUrls?: string[];
    highlightedWarpedMapUrl?: string;
    highlightEnabled?: boolean;
    top?: string;
    bottomMargin?: string;
    onToggleVisibility?: (url: string) => void;
    onZoomToBounds?: (url: string) => void;
    onHighlight?: (url?: string) => void;
    class?: string;
  };

  const ALLMAPS_VIEWER_BASE_URL = "https://viewer.allmaps.org/?url=";
  const EXTERNAL_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

  let {
    chapter,
    hiddenWarpedMapUrls = [],
    highlightedWarpedMapUrl,
    highlightEnabled = false,
    top,
    bottomMargin,
    onToggleVisibility,
    onZoomToBounds,
    onHighlight,
    class: className = "",
  }: Props = $props();

  const warpedMaps = $derived(chapter?.warpedMaps ?? []);
  const hiddenWarpedMapUrlSet = $derived(new Set(hiddenWarpedMapUrls));
  const hiddenCount = $derived(
    warpedMaps.filter((warpedMap) =>
      hiddenWarpedMapUrlSet.has(warpedMap.url),
    ).length,
  );
  const visibleCount = $derived(warpedMaps.length - hiddenCount);

  const getFilenameLabel = (path: string) => {
    const cleanPath = path.split(/[?#]/)[0];
    const lastSegment = cleanPath.split("/").filter(Boolean).at(-1);

    return lastSegment?.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
  };

  const getUrlHost = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  };

  const getLayerTitle = (warpedMap: WarpedMapProps, index: number) =>
    warpedMap.caption ??
    getFilenameLabel(warpedMap.homepage ?? warpedMap.url) ??
    `Map layer ${index + 1}`;

  const getLayerMeta = (warpedMap: WarpedMapProps) =>
    warpedMap.provenance ??
    getUrlHost(warpedMap.homepage ?? warpedMap.url) ??
    (warpedMap.type === "Image" ? "Image layer" : "Georeference annotation");

  const isExternalUrl = (url: string) =>
    EXTERNAL_URL_PATTERN.test(url) || url.startsWith("//");

  const getAbsoluteAnnotationUrl = (url: string) => {
    if (isExternalUrl(url)) return url;
    if (dev) return new URL(url, page.url.origin).href;

    const publicUrl = env.PUBLIC_URL?.trim();
    if (publicUrl && isExternalUrl(publicUrl)) {
      return new URL(url, publicUrl).href;
    }

    return browser ? new URL(url, window.location.origin).href : url;
  };

  const getAllmapsViewerUrl = (annotationUrl: string) =>
    `${ALLMAPS_VIEWER_BASE_URL}${encodeURIComponent(
      getAbsoluteAnnotationUrl(annotationUrl),
    )}`;

  const isWarpedMapHidden = (warpedMap: WarpedMapProps) =>
    hiddenWarpedMapUrlSet.has(warpedMap.url);

  const setLayerHighlight = (url?: string) => {
    if (!highlightEnabled) return;

    onHighlight?.(url);
  };

  const toggleLayerVisibility = (url: string) => {
    onToggleVisibility?.(url);
  };

  const stopLayerRowClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const handleLayerRowKeydown = (event: KeyboardEvent, url: string) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    toggleLayerVisibility(url);
  };

  const describeLayerCount = () => {
    if (warpedMaps.length === 0) return "No map layers for this slide";

    const visibleText = `${visibleCount} map ${
      visibleCount === 1 ? "layer" : "layers"
    } visible`;

    return hiddenCount > 0
      ? `${visibleText}, ${hiddenCount} hidden`
      : visibleText;
  };
</script>

<PanelOverlay title="Map layers" {top} {bottomMargin} class={className}>
  <div class="mb-3 flex items-center gap-2 text-[16px] leading-[1.1] font-normal text-[var(--app-muted)]">
    <Layers size={16} aria-hidden="true" />
    <span class="translate-y-[0.07em]">{describeLayerCount()}</span>
  </div>

  {#if warpedMaps.length > 0}
    <ol class="space-y-1.5">
      {#each warpedMaps as warpedMap, index (warpedMap.url)}
        {@const hidden = isWarpedMapHidden(warpedMap)}
        {@const highlighted = highlightedWarpedMapUrl === warpedMap.url}
        {@const title = getLayerTitle(warpedMap, index)}
        <li>
          <div
            role="button"
            tabindex="0"
            aria-label={hidden ? `Show ${title}` : `Hide ${title}`}
            aria-pressed={!hidden}
            class="layer-row {hidden ? 'layer-row--hidden' : ''} {highlighted
              ? 'layer-row--highlighted'
              : ''}"
            onpointerenter={() => setLayerHighlight(warpedMap.url)}
            onpointerleave={() => setLayerHighlight(undefined)}
            onclick={() => toggleLayerVisibility(warpedMap.url)}
            onkeydown={(event) => handleLayerRowKeydown(event, warpedMap.url)}
          >
            <div class="layer-preview" aria-hidden="true">
              <Layers size={26} />
            </div>

            <div class="min-w-0 flex-1">
              <h3 class="layer-title">{title}</h3>
              <div class="layer-links">
                {#if warpedMap.homepage}
                  <a
                    class="layer-meta layer-link"
                    href={warpedMap.homepage}
                    target="_blank"
                    rel="noreferrer"
                    onclick={stopLayerRowClick}
                  >
                    <span>{getLayerMeta(warpedMap)}</span>
                    <MoveUpRight size={12} aria-hidden="true" />
                  </a>
                {:else}
                  <p class="layer-meta">{getLayerMeta(warpedMap)}</p>
                {/if}

                {#if warpedMap.type !== "Image"}
                  <a
                    class="layer-meta layer-link"
                    href={getAllmapsViewerUrl(warpedMap.url)}
                    target="_blank"
                    rel="noreferrer"
                    onclick={stopLayerRowClick}
                  >
                    <span>Open in Allmaps</span>
                    <MoveUpRight size={12} aria-hidden="true" />
                  </a>
                {/if}
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-1">
              <button
                type="button"
                class="layer-icon-button"
                aria-label={hidden ? "Show map layer" : "Hide map layer"}
                aria-pressed={!hidden}
                title={hidden ? "Show map layer" : "Hide map layer"}
                onfocus={() => setLayerHighlight(warpedMap.url)}
                onblur={() => setLayerHighlight(undefined)}
                onclick={(event) => {
                  event.stopPropagation();
                  toggleLayerVisibility(warpedMap.url);
                }}
              >
                {#if hidden}
                  <EyeOff size={16} aria-hidden="true" />
                {:else}
                  <Eye size={16} aria-hidden="true" />
                {/if}
              </button>

              <button
                type="button"
                class="layer-icon-button"
                aria-label="Zoom to map layer"
                title="Zoom to map layer"
                onfocus={() => setLayerHighlight(warpedMap.url)}
                onblur={() => setLayerHighlight(undefined)}
                onclick={(event) => {
                  event.stopPropagation();
                  onZoomToBounds?.(warpedMap.url);
                }}
              >
                <ScanSearch size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ol>
  {:else}
    <p class="py-2 font-body text-[15px] leading-[1.35] text-[var(--app-muted)]">
      This slide does not use any warped maps.
    </p>
  {/if}
</PanelOverlay>

<style>
  .layer-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    padding: 0.375rem;
    transition:
      background-color 150ms ease,
      opacity 150ms ease;
  }

  .layer-row:hover,
  .layer-row--highlighted {
    background: var(--app-overlay-selected-bg);
  }

  .layer-row--hidden {
    opacity: 0.58;
  }

  .layer-preview {
    display: inline-flex;
    height: 3.5rem;
    width: 3.5rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    background: rgb(255 255 255 / 0.45);
    color: var(--app-overlay-icon);
  }

  :global(.dark) .layer-preview {
    background: rgb(255 255 255 / 0.08);
  }

  .layer-title {
    overflow-wrap: anywhere;
    transform: translateY(0.07em);
    font-size: 18px;
    font-weight: 400;
    line-height: 1.15;
    color: var(--app-text);
  }

  .layer-meta {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.15rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.25;
    color: var(--app-muted);
  }

  .layer-links {
    margin-top: 0.125rem;
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.25rem 0.625rem;
  }

  .layer-link span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .layer-link {
    cursor: pointer;
    color: var(--highlight-fg);
    font-weight: 500;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.12em;
  }

  .layer-link:hover {
    text-decoration-line: underline;
  }

  .layer-icon-button {
    display: inline-flex;
    height: 1.75rem;
    width: 1.75rem;
    flex-shrink: 0;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    color: var(--app-overlay-icon);
    transition: background-color 150ms ease;
  }

  .layer-icon-button:hover {
    background: var(--app-overlay-selected-bg);
  }

  .layer-icon-button:disabled {
    cursor: default;
    opacity: 0.35;
  }

  .layer-icon-button:disabled:hover {
    background: transparent;
  }
</style>
