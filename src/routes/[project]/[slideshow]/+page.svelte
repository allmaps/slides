<script lang="ts">
  import Slideshow from "$lib/components/Slideshow.svelte";
  import { getSlideshowByRoute } from "$lib/shared/projects";

  let { data } = $props();

  const route = getSlideshowByRoute(data.project, data.slideshow);
</script>

{#if route}
  <Slideshow project={route.project} slideshow={route.slideshow} />
{/if}
