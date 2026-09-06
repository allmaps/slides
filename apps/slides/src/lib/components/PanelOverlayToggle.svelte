<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";

  type Props = HTMLButtonAttributes & {
    active?: boolean;
    children?: Snippet;
    class?: string;
  };

  let {
    active = false,
    children,
    class: className = "",
    ...restProps
  }: Props = $props();
</script>

<button
  type="button"
  class="panel-overlay-toggle inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors {active
    ? 'panel-overlay-toggle--active h-8 w-8 rounded-md text-transparent'
    : 'h-8 w-8 rounded-md text-[var(--app-icon)] hover:bg-[var(--app-hover-bg)]'} {className}"
  aria-expanded={active}
  {...restProps}
>
  {@render children?.()}
</button>
