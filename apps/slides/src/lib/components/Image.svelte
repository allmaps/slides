<script lang="ts">
  import type { HTMLImgAttributes } from "svelte/elements";
  import {
    getContentAssetUrl,
    getContentIiifImage,
    isExternalUrl,
    joinUrl,
    withBaseUrl,
  } from "$lib/shared/paths";

  let {
    src,
    "data-dark-src": darkSrc,
    alt,
    width,
    height,
    class: className,
    "data-inline": inline = false,
    loading = "lazy",
    decoding = "async",
    ...restProps
  }: HTMLImgAttributes & { "data-dark-src"?: string; "data-inline"?: boolean } = $props();

  const resolveSrc = (src: string | undefined | null) => {
    if (!src || isExternalUrl(src) || src.startsWith("data:")) return src;

    const assetUrl = getContentAssetUrl(src);
    if (assetUrl) return assetUrl;

    return withBaseUrl(src);
  };

  const resolvedSrc = $derived(resolveSrc(src));
  // The prose styles use height:auto for responsive width-sized images. Honour
  // an authored height when it is the only dimension, with width left intrinsic.
  const imageHeight = $derived(height !== undefined && width === undefined ? `${height}px` : undefined);
  const resolveInlineSrc = (source: string | undefined | null) => {
    const image = getContentIiifImage(source?.split("#")[0]);
    return image ? withBaseUrl(joinUrl("iiif", image.servicePath, "full", "max", "0", "default.jpg")) : resolveSrc(source);
  };
  const iiifImage = $derived(getContentIiifImage(src?.split("#")[0]));
  const imageService = $derived(iiifImage
    ? withBaseUrl(joinUrl("iiif", iiifImage.servicePath)) + (src?.includes("#") ? `#${src.split("#")[1]}` : "")
    : undefined);
</script>

{#if darkSrc}
  <span class="themed-image">
    <img class={["themed-image__light", className]} src={resolveInlineSrc(src)} {alt} {width} {height} {loading} {decoding} style:height={imageHeight} {...restProps} />
    <img class={["themed-image__dark", className]} src={resolveInlineSrc(darkSrc)} {alt} {width} {height} {loading} {decoding} style:height={imageHeight} {...restProps} />
  </span>
{:else if iiifImage && !inline}
  <!-- Atlas loads this local derivative; no separate preview image is fetched. -->
  <span data-iiif-image={imageService} data-alt={alt}></span>
{:else}
  <!-- Images inside a sentence stay inline, including local derivatives. -->
  <img
    class={className}
    src={iiifImage ? withBaseUrl(joinUrl("iiif", iiifImage.servicePath, "full", "max", "0", "default.jpg")) : resolvedSrc}
    {alt}
    {width}
    {height}
    {loading}
    {decoding}
    style:height={imageHeight}
    {...restProps}
  />
{/if}

<style>
  img {
    /* Keep the artwork proportional if max-width constrains a fixed height. */
    object-fit: contain;
  }
  .themed-image {
    display: inline-block;
    max-width: 100%;
    vertical-align: middle;
  }
  .themed-image > .themed-image__light { display: block; }
  .themed-image > .themed-image__dark { display: none; }
  :global(:root[data-theme="dark"]) .themed-image > .themed-image__light { display: none; }
  :global(:root[data-theme="dark"]) .themed-image > .themed-image__dark { display: block; }
  @media (prefers-color-scheme: dark) {
    :global(:root:not([data-theme])) .themed-image > .themed-image__light { display: none; }
    :global(:root:not([data-theme])) .themed-image > .themed-image__dark { display: block; }
  }
</style>
