<script lang="ts">
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { getSlideshowPageTitle } from "$lib/shared/seo";

  import favicon from "$lib/assets/favicon.svg";
  import appIcon from "$lib/assets/apple-touch-icon.png";
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
  const pageTitle = $derived(getSlideshowPageTitle(project, slideshow));
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <link rel="icon" href={favicon} />
  <link rel="apple-touch-icon" sizes="180x180" href={appIcon} />
  <link rel="manifest" href={`${base}/manifest.webmanifest`} />
  <meta name="apple-mobile-web-app-title" content={mainSlideshow?.title ?? project.title} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
</svelte:head>

{#if slideshow && mainSlideshow}
  <Slideshow {project} {slideshow} {mainSlideshow} thumbnails={data.thumbnails} />
{:else}
  {@render children()}
{/if}
