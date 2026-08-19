<script lang="ts">
  import Slideshow from "$lib/components/Slideshow.svelte";
  import { getSlideshowByRoute } from "$lib/shared/projects";

  let { data } = $props();

  const route = $derived(getSlideshowByRoute(data.project, data.slideshow));
</script>

{#if route}
  {#key `${route.project.slug}:${route.slideshow.id}`}
    <Slideshow project={route.project} slideshow={route.slideshow} />
  {/key}
{/if}
