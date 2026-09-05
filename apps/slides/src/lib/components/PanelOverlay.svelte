<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade } from "svelte/transition";

  type Props = {
    title: string;
    top?: string;
    bottomMargin?: string;
    actions?: Snippet;
    children?: Snippet;
    class?: string;
  };

  let {
    title,
    top = "0",
    bottomMargin = "0.25rem",
    actions,
    children,
    class: className = "",
  }: Props = $props();
</script>

<div
  class="panel-overlay absolute inset-x-1 z-40 overflow-x-hidden overflow-y-auto rounded-lg bg-[var(--app-overlay-bg)] p-3 text-[var(--app-text)] sm:p-4 {className}"
  style={`--panel-overlay-top: ${top}; --panel-overlay-bottom-margin: ${bottomMargin};`}
  transition:fade={{ duration: 150 }}
>
  <div class="mb-2 flex items-center justify-between gap-3">
    <h2 class="translate-y-[0.08em] text-[28px] leading-[1.1] font-normal">
      {title}
    </h2>

    {@render actions?.()}
  </div>

  {@render children?.()}
</div>

<style>
  .panel-overlay {
    top: var(--panel-overlay-top);
    max-height: calc(
      100% - var(--panel-overlay-top) - var(--panel-overlay-bottom-margin)
    );
    overscroll-behavior: contain;
  }
</style>
