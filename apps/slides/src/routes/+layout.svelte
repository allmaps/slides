<script lang="ts">
  import { page } from "$app/state";
  import { base } from "$app/paths";
  import { getSlideshowPageTitle } from "$lib/shared/seo";
  import { createInterfaceText } from "$lib/shared/interface-settings";

  import favicon from "$lib/assets/favicon.svg";
  import appIcon from "$lib/assets/apple-touch-icon.png";
  import Slideshow from "$lib/components/Slideshow.svelte";
  import EmptyContent from "$lib/components/EmptyContent.svelte";
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
  const slideshowRoute = $derived(page.route.id === "/" || page.route.id === "/[slideshow]");
  const t = createInterfaceText(() => project.interface);
  const pageTitle = $derived.by(() => {
    const key = page.route.id === "/iiif" ? "iiifOverview"
      : page.route.id === "/thumbnails" ? "thumbnailsOverview"
      : slideshowRoute && !slideshow?.chapters.length ? "noContent" : undefined;
    return key ? `${t(key)} — ${project.title}` : getSlideshowPageTitle(project, slideshow);
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
  <link rel="icon" href={favicon} />
  <link rel="apple-touch-icon" sizes="180x180" href={appIcon} />
  <link rel="manifest" href={`${base}/manifest.webmanifest`} />
  <meta name="apple-mobile-web-app-title" content={project.title} />
  <meta name="apple-mobile-web-app-capable" content="yes" />
</svelte:head>

{#if slideshowRoute && slideshow?.chapters.length && mainSlideshow}
  <Slideshow {project} {slideshow} {mainSlideshow} thumbnails={data.thumbnails} />
{:else if slideshowRoute}
  <EmptyContent {project} generation={data.generation} />
{:else}
  {@render children()}
{/if}
