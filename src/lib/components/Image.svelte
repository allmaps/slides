<script lang="ts">
  import { getContext } from "svelte";
  import type { HTMLImgAttributes } from "svelte/elements";
  import baseUrl from "$lib/shared/base-url";
  import { isExternalUrl } from "$lib/shared/paths";

  let { src, alt }: HTMLImgAttributes = $props();

  const projectAssetBase = getContext<string | undefined>("projectAssetBase");

  const resolveSrc = (src: string | undefined | null) => {
    if (!src || isExternalUrl(src) || src.startsWith("data:")) return src;

    if (projectAssetBase) {
      const cleanSrc = src.replace(/^\/+/, "");

      if (cleanSrc.startsWith("images/")) {
        return `${projectAssetBase.replace(/\/+$/, "")}/${cleanSrc}`;
      }
    }

    return `${baseUrl}${src}`;
  };

  const resolvedSrc = $derived(resolveSrc(src));
</script>

<figure>
  <img src={resolvedSrc} {alt} />
  <figcaption>{@html alt}</figcaption>
</figure>
