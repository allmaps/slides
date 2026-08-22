<script lang="ts">
  import { getContext } from "svelte";
  import type { HTMLImgAttributes } from "svelte/elements";
  import {
    getContentAssetUrl,
    isExternalUrl,
    withBaseUrl,
  } from "$lib/shared/paths";

  let { src, alt }: HTMLImgAttributes = $props();

  const projectFolder = getContext<string | undefined>("projectFolder");

  const resolveSrc = (src: string | undefined | null) => {
    if (!src || isExternalUrl(src) || src.startsWith("data:")) return src;

    if (projectFolder) {
      const assetUrl = getContentAssetUrl(projectFolder, src);
      if (assetUrl) return assetUrl;
    }

    return withBaseUrl(src);
  };

  const resolvedSrc = $derived(resolveSrc(src));
</script>

<figure>
  <img src={resolvedSrc} {alt} />
  <figcaption>{@html alt}</figcaption>
</figure>
