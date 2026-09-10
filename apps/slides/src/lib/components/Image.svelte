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
    alt,
    "data-inline": inline = false,
    loading = "lazy",
    decoding = "async",
    ...restProps
  }: HTMLImgAttributes & { "data-inline"?: boolean } = $props();

  const resolveSrc = (src: string | undefined | null) => {
    if (!src || isExternalUrl(src) || src.startsWith("data:")) return src;

    const assetUrl = getContentAssetUrl(src);
    if (assetUrl) return assetUrl;

    return withBaseUrl(src);
  };

  const resolvedSrc = $derived(resolveSrc(src));
  const iiifImage = $derived(getContentIiifImage(src?.split("#")[0]));
  const imageService = $derived(iiifImage
    ? withBaseUrl(joinUrl("iiif", iiifImage.servicePath)) + (src?.includes("#") ? `#${src.split("#")[1]}` : "")
    : undefined);
</script>

{#if iiifImage && !inline}
  <!-- Atlas loads this local derivative; no separate preview image is fetched. -->
  <span data-iiif-image={imageService} data-alt={alt}></span>
{:else}
  <!-- Images inside a sentence stay inline, including local derivatives. -->
  <img
    src={iiifImage ? withBaseUrl(joinUrl("iiif", iiifImage.servicePath, "full", "max", "0", "default.jpg")) : resolvedSrc}
    {alt}
    {loading}
    {decoding}
    {...restProps}
  />
{/if}
