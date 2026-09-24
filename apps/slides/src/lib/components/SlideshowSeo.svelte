<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { createSlideshowSeo, serializeJsonLd } from "$lib/shared/seo";
  import type { Project, Slideshow } from "$lib/shared/types";
  import type { Thumbnail } from "$lib/shared/thumbnails";

  let { project, slideshow, image }: {
    project: Project;
    slideshow: Slideshow;
    image?: Thumbnail;
  } = $props();

  const metadata = $derived(createSlideshowSeo({
    project,
    slideshow,
    publicUrl: env.PUBLIC_URL,
    imagePath: image?.path,
  }));
</script>

<svelte:head>
  {#if metadata.canonical}
    <link rel="canonical" href={metadata.canonical} />
    <meta property="og:url" content={metadata.canonical} />
  {/if}
  <meta name="description" content={metadata.description} />
  <meta property="og:title" content={metadata.title} />
  <meta name="twitter:title" content={metadata.title} />
  <meta property="og:description" content={metadata.description} />
  {#if image && metadata.image}
    <meta property="og:image" content={metadata.image} />
    <meta property="og:image:width" content={String(image.width)} />
    <meta property="og:image:height" content={String(image.height)} />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:alt" content={slideshow.chapters[0]?.title ?? slideshow.title} />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content={metadata.image} />
  {/if}
  {#if metadata.jsonLd}
    {@html `<script type="application/ld+json">${serializeJsonLd(metadata.jsonLd)}</script>`}
  {/if}
</svelte:head>
