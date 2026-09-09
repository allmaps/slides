<script lang="ts">
  import { page } from "$app/state";

  import favicon from "$lib/assets/favicon.svg";
  import Slideshow from "$lib/components/Slideshow.svelte";
  import {
    getProject,
    getMainSlideshow,
    getSlideshowByRoute,
  } from "$lib/shared/project";

  import "../app.css";

  let { children } = $props();

  const project = getProject();
  const slideshow = $derived(getSlideshowByRoute(page.params.slideshow));
  const mainSlideshow = getMainSlideshow();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if slideshow && mainSlideshow}
  <Slideshow {project} {slideshow} {mainSlideshow} />
{:else}
  {@render children()}
{/if}
