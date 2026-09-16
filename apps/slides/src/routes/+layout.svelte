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

  let { children, data } = $props();

  const project = getProject();
  const slideshow = $derived(getSlideshowByRoute(page.params.slideshow));
  const mainSlideshow = getMainSlideshow();
  const pageTitle = $derived(
    slideshow && slideshow.id !== project.main && slideshow.title !== project.title
      ? `${project.title} — ${slideshow.title}`
      : project.title,
  );
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if slideshow && mainSlideshow}
  <Slideshow {project} {slideshow} {mainSlideshow} thumbnails={data.thumbnails} />
{:else}
  {@render children()}
{/if}
