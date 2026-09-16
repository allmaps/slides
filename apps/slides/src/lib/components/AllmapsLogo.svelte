<script lang="ts">
  import type { HTMLImgAttributes } from "svelte/elements";

  import logo from "$lib/assets/allmaps-logo.svg";
  import invertedLogo from "$lib/assets/allmaps-logo-inverted.svg";

  type Props = Omit<HTMLImgAttributes, "src"> & {
    inverted?: boolean;
  };

  let {
    inverted = false,
    alt = "Allmaps",
    class: className,
    ...restProps
  }: Props = $props();

  const src = $derived(inverted ? invertedLogo : logo);
  const classes = $derived(
    ["allmaps-logo", className].filter(Boolean).join(" "),
  );
</script>

<img {src} {alt} class={classes} {...restProps} />
