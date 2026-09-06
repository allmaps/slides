<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import { X } from "@lucide/svelte";

  type Props = {
    title: string;
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
    top = "0",
    bottomMargin = "0.25rem",
    tab,
    closeLabel = "Close overlay",
    onClose,
    actions,
    children,
    class: className = "",
  }: Props = $props();
</script>

<div
  class="panel-overlay-shell absolute inset-x-1 z-40 {tab
    ? `panel-overlay-shell--tab panel-overlay-shell--${tab}`
    : ''} {className}"
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
    class="panel-overlay overflow-x-hidden overflow-y-auto rounded-lg bg-[var(--app-overlay-bg)] p-3 text-[var(--app-text)] sm:p-4"
  >
    <div class="mb-2 flex items-center justify-between gap-3">
      <h2 class="translate-y-[0.08em] text-[28px] leading-[1.1] font-normal">
        {title}
      </h2>

      {@render actions?.()}
    </div>

    {@render children?.()}
  </div>
</div>

<style>
  .panel-overlay-shell {
    top: var(--panel-overlay-top);
    bottom: var(--panel-overlay-bottom-margin);
    pointer-events: none;
  }

  .panel-overlay {
    max-height: 100%;
    overscroll-behavior: contain;
    pointer-events: auto;
  }

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
