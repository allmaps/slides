<script lang="ts">
  import { getContext } from "svelte";
  import type { HTMLImgAttributes } from "svelte/elements";
  import type { ContentIiifImage } from "$lib/shared/paths";
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
    sizes: sizesAttribute = "100vw",
    loading = "lazy",
    decoding = "async",
    ...restProps
  }: HTMLImgAttributes = $props();

  const projectFolder = getContext<string | undefined>("projectFolder") ?? "";

  const resolveSrc = (src: string | undefined | null) => {
    if (!src || isExternalUrl(src) || src.startsWith("data:")) return src;

    const assetUrl = getContentAssetUrl(projectFolder, src);
    if (assetUrl) return assetUrl;

    return withBaseUrl(src);
  };

  const resolvedSrc = $derived(resolveSrc(src));
  const iiifImage = $derived(getContentIiifImage(projectFolder, src));

  const getIiifUrl = (
    image: ContentIiifImage,
    size: string,
    format: string,
  ) =>
    withBaseUrl(
      joinUrl("iiif", image.servicePath, "full", size, "0", `default.${format}`),
    );

  const getSrcset = (
    image: ContentIiifImage,
    format: string,
  ) =>
    image.sizes
      .map((candidate) => {
        const url = getIiifUrl(image, candidate.size, format);
        return `${url} ${candidate.width}w`;
      })
      .join(", ");
</script>

<figure>
  {#if iiifImage}
    <picture>
      {#if iiifImage.formats.includes("webp")}
        <source
          type="image/webp"
          srcset={getSrcset(iiifImage, "webp")}
          sizes={sizesAttribute}
        />
      {/if}
      <source
        type="image/jpeg"
        srcset={getSrcset(iiifImage, "jpg")}
        sizes={sizesAttribute}
      />
      <img
        src={getIiifUrl(iiifImage, "max", "jpg")}
        width={iiifImage.width}
        height={iiifImage.height}
        {alt}
        {loading}
        {decoding}
        {...restProps}
      />
    </picture>
  {:else}
    <img src={resolvedSrc} {alt} {loading} {decoding} {...restProps} />
  {/if}
  <figcaption>{@html alt}</figcaption>
</figure>
