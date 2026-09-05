<script lang="ts">
  import { MoveUpRight } from "@lucide/svelte";
  import type { HTMLAnchorAttributes } from "svelte/elements";

  const EXTERNAL_URL_PATTERN = /^[a-z][a-z\d+.-]*:/i;

  let { href, children, ...restProps }: HTMLAnchorAttributes = $props();

  const isExternal = $derived(
    typeof href === "string" &&
      (EXTERNAL_URL_PATTERN.test(href) || href.startsWith("//")),
  );
  const target = $derived(isExternal ? "_blank" : undefined);
  const rel = $derived(isExternal ? "noreferrer" : undefined);
</script>

<a
  {href}
  {target}
  {rel}
  data-external={isExternal ? "true" : undefined}
  {...restProps}
>
  {@render children?.()}
  {#if isExternal}
    <MoveUpRight
      class="ml-0.5 inline size-[0.85em] translate-y-[-0.08em]"
      strokeWidth={2}
      aria-hidden="true"
    />
  {/if}
</a>
