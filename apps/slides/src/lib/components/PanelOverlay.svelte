<script lang="ts">
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import { tick, type Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { X } from "@lucide/svelte";

  type Props = {
    title: string;
    open?: boolean;
    top?: string;
    bottomMargin?: string;
    tab?: "toc" | "layers";
    closeLabel?: string;
    onClose?: () => void;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
  };

  let {
    title,
    open = true,
    top = "0",
    bottomMargin = "0.25rem",
    tab,
    closeLabel = t("close"),
    onClose,
    actions,
    children,
    class: className = "",
  }: Props = $props();

  let element: HTMLDivElement;
  $effect(() => {
    if (!open) return;
    const previous = document.activeElement;
    let cancelled = false;
    tick().then(() => {
      if (!cancelled) element?.querySelector<HTMLElement>(".panel-overlay-content")?.focus({ preventScroll: true });
    });
    return () => {
      cancelled = true;
      // A conditional overlay may already have left the DOM during teardown,
      // in which case the browser has moved focus back to the document body.
      if ((element?.contains(document.activeElement) || document.activeElement === document.body) && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  });
</script>

<div
  class="panel-overlay-shell absolute inset-x-0 z-40 {tab
    ? `panel-overlay-shell--tab panel-overlay-shell--${tab}`
    : ''} {className}"
  class:panel-overlay-shell--closed={!open}
  inert={!open}
  style={`--panel-overlay-top: ${top}; --panel-overlay-bottom-margin: ${bottomMargin};`}
  transition:fade={{ duration: 150 }}
>
  {#if tab}
    <button
      type="button"
      class="panel-overlay-tab"
      aria-label={closeLabel}
      title={closeLabel}
      onclick={onClose}
    >
      <span class="panel-overlay-tab-icon">
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </span>
    </button>
  {/if}

  <div
    bind:this={element}
    role="region"
    aria-label={title}
    tabindex="-1"
    class="panel-overlay overflow-hidden bg-[var(--app-overlay-bg)] text-[var(--app-text)]"
  >
    <div class="panel-overlay-header flex shrink-0 items-center justify-between gap-3 p-3 pb-2 sm:p-4 sm:pb-2">
      <h2 class="min-w-0 translate-y-[0.08em] text-[28px] leading-[1.1] font-normal">
        {title}
      </h2>

      <div class="flex shrink-0 items-center gap-2">
        {@render actions?.()}
        {#if !tab}
          <button type="button" class="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-[var(--app-overlay-icon)] hover:bg-[var(--app-overlay-selected-bg)]" aria-label={closeLabel} title={closeLabel} onclick={onClose}>
            <X size={22} aria-hidden="true" />
          </button>
        {/if}
      </div>
    </div>

    <div tabindex="-1" class="panel-overlay-content panel-scrollbar min-h-0 overflow-x-hidden overflow-y-auto px-3 pb-3 outline-none sm:px-4 sm:pb-4">
      {@render children?.()}
    </div>
  </div>
</div>

<style>
  .panel-overlay-shell {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    top: var(--panel-overlay-top);
    bottom: var(--panel-overlay-bottom-margin);
    pointer-events: none;
    transition: opacity 150ms, visibility 150ms;
  }

  .panel-overlay-shell--closed {
    opacity: 0;
    visibility: hidden;
  }

  .panel-overlay {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 0;
    z-index: 2;
    max-height: 100%;
    border: 6px solid transparent;
    border-radius: 17px;
    background-clip: border-box;
    pointer-events: auto;
  }
  .panel-overlay-content { overscroll-behavior: contain; }

  .panel-overlay-tab {
    position: absolute;
    top: calc(-1 * var(--panel-overlay-tab-height) + 0.625rem);
    right: var(--panel-overlay-tab-right);
    z-index: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--panel-overlay-tab-width);
    height: var(--panel-overlay-tab-height);
    border-radius: 0.625rem 0.625rem 0 0;
    border: 0;
    background: var(--app-overlay-bg);
    color: var(--app-overlay-icon);
    cursor: pointer;
    padding: 0;
    pointer-events: auto;
  }

  .panel-overlay-tab-icon {
    display: inline-flex;
    transform: translateY(-0.25rem);
  }

  .panel-overlay-shell--tab {
    --panel-overlay-tab-width: 2.75rem;
    --panel-overlay-tab-height: 2.75rem;
    --panel-overlay-tab-right: 0.7rem;
  }

  .panel-overlay-shell--toc {
    --panel-overlay-tab-right: 3.2rem;
  }
</style>
