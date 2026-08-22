<script lang="ts">
  import Slideshow from "$lib/components/Slideshow.svelte";
  import {
    getProjectRouteHref,
    getProjects,
    getRootSlideshowByRoute,
  } from "$lib/shared/projects";

  const projects = getProjects();
  const rootRoute = getRootSlideshowByRoute();
</script>

<svelte:head>
  <title>{rootRoute ? rootRoute.slideshow.title : "Slides"}</title>
</svelte:head>

{#if rootRoute}
  {#key `${rootRoute.project.slug}:${rootRoute.slideshow.id}`}
    <Slideshow project={rootRoute.project} slideshow={rootRoute.slideshow} />
  {/key}
{:else}
  <main class="min-h-screen bg-white text-black dark:bg-black dark:text-white">
    <div class="mx-auto max-w-3xl px-6 py-10">
      <h1 class="text-3xl font-semibold">Slides</h1>

      <div class="mt-8 border-y border-black/15 dark:border-white/20">
        {#each projects as project}
          <a
            class="block py-5 hover:bg-black/5 dark:hover:bg-white/10"
            href={getProjectRouteHref(project)}
          >
            <h2 class="text-xl font-medium">{project.title}</h2>
            {#if project.description}
              <p class="mt-2 text-sm opacity-70">{project.description}</p>
            {/if}
          </a>
        {/each}
      </div>
    </div>
  </main>
{/if}
