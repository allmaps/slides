<script lang="ts">
  import { page } from "$app/state";

  import favicon from "$lib/assets/favicon.svg";
  import Slideshow from "$lib/components/Slideshow.svelte";
  import {
    getMainSlideshow,
    getRootSlideshowByRoute,
    getSlideshowByRoute,
    isSingleProjectRootMode,
  } from "$lib/shared/projects";

  import "../app.css";

  let { children } = $props();

  const route = $derived.by(() => {
    if (isSingleProjectRootMode()) {
      if (page.params.slideshow) return undefined;
      return getRootSlideshowByRoute(page.params.project);
    }

    if (!page.params.project) return undefined;
    return getSlideshowByRoute(page.params.project, page.params.slideshow);
  });
  const mainSlideshow = $derived(
    route ? getMainSlideshow(route.project) : undefined,
  );
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if route && mainSlideshow}
  {#key route.project.slug}
    <Slideshow
      project={route.project}
      slideshow={route.slideshow}
      {mainSlideshow}
    />
  {/key}
{:else}
  {@render children()}
{/if}
