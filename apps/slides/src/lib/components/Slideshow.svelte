<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { ArrowLeft, ListTree, X } from "@lucide/svelte";

  import Map from "$lib/components/Map.svelte";
  import SlideshowPanel from "$lib/components/SlideshowPanel.svelte";
  import { getGeoJsonLayers } from "$lib/shared/geojson";
  import { getSlideshowRouteHref } from "$lib/shared/projects";
  import { DEFAULT_DURATION } from "$lib/shared/settings";
  import type { Project, Slideshow } from "$lib/shared/types";

  type Props = {
    project: Project;
    slideshow: Slideshow;
    mainSlideshow?: Slideshow;
  };

  let { project, slideshow, mainSlideshow }: Props = $props();

  setContext("projectFolder", project.folder);

  const activeSlideshow = $derived(slideshow);
  const rootSlideshow = $derived(mainSlideshow ?? slideshow);
  const subslideshow = $derived(
    activeSlideshow.id === rootSlideshow.id ? undefined : activeSlideshow,
  );
  const isSubslideshowActive = $derived(subslideshow !== undefined);
  const chapters = $derived(activeSlideshow.chapters);
  const sources = $derived(activeSlideshow.sources);

  let isDarkMode: boolean | undefined = $state(undefined);
  let mainIndex: number = $state(0);
  let subslideshowIndex: number = $state(0);
  let tocOpen: boolean = $state(false);

  const layers = $derived(Object.entries(sources).flatMap(([sourceId, source]) =>
    source.type === "geojson" ? getGeoJsonLayers(sourceId, "visible") : [],
  ));

  const firstChapter = $derived(chapters[0]);
  const slideshowKey = $derived(`${project.slug}:${activeSlideshow.id}`);
  const activeIndex = $derived(
    isSubslideshowActive ? subslideshowIndex : mainIndex,
  );
  const activeChapter = $derived(chapters[activeIndex]);
  const headerTitle = $derived(rootSlideshow.title);
  const headerSubTitle = $derived(
    isSubslideshowActive ? activeSlideshow.title : undefined,
  );
  const headerChapterTitle = $derived(activeChapter?.title);
  const headerActiveTitle = $derived(headerSubTitle ?? headerTitle);
  const showHeaderChapterTitle = $derived(
    headerChapterTitle !== undefined && headerChapterTitle !== headerActiveTitle,
  );
  const headerAccessibleTitle = $derived.by(() =>
    [headerTitle, headerSubTitle, showHeaderChapterTitle ? headerChapterTitle : undefined]
      .filter((title, index, titles) => title && titles.indexOf(title) === index)
      .join(", "),
  );
  const mainHref = $derived(getSlideshowRouteHref(project, rootSlideshow));
  const mainBreadcrumbHref = $derived.by(() => {
    const slug = rootSlideshow.chapters[mainIndex]?.slug;
    return slug ? `${mainHref}#${encodeURIComponent(slug)}` : mainHref;
  });

  const closeToc = () => {
    tocOpen = false;
  };

  const toggleToc = () => {
    tocOpen = !tocOpen;
  };

  $effect(() => {
    activeSlideshow.id;
    closeToc();
  });

  onMount(() => {
    let media: MediaQueryList | undefined;
    const handleMediaChange = (event: MediaQueryListEvent) => {
      isDarkMode = event.matches;
    };

    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
      isDarkMode = media.matches;
      media.addEventListener("change", handleMediaChange);
    } catch {
      isDarkMode = false;
    }

    return () => {
      media?.removeEventListener("change", handleMediaChange);
    };
  });
</script>

<svelte:head>
  <title>{activeSlideshow.title}</title>
  <meta name="description" content={firstChapter?.description ?? project.description} />
</svelte:head>

<div
  class="h-app-screen w-screen grid grid-cols-1 grid-rows-2 md:grid-rows-1 md:grid-cols-[1fr_480px] xl:grid-cols-[1fr_600px]"
>
  <div class="min-h-0 md:row-span-full">
    {#if isDarkMode !== undefined}
      {#key `${slideshowKey}:${isDarkMode}`}
        <Map
          {chapters}
          index={activeIndex}
          {isDarkMode}
          {sources}
          {layers}
          anticipate
          duration={DEFAULT_DURATION}
        />
      {/key}
    {/if}
  </div>

  <div
    class="row-start-2 flex min-h-0 flex-col overflow-hidden bg-white/80 dark:bg-black/80 md:row-start-1"
  >
    <header
      class="relative z-30 flex h-12 shrink-0 items-center gap-3 border-b border-black/10 bg-white/90 px-5 text-sm text-black backdrop-blur dark:border-white/15 dark:bg-black/90 dark:text-white"
    >
      {#if isSubslideshowActive}
        <a
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          href={mainBreadcrumbHref}
          aria-label={`Back to ${rootSlideshow.title}`}
          title={`Back to ${rootSlideshow.title}`}
          onclick={closeToc}
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </a>
      {/if}

      <div
        class="flex min-w-0 flex-1 items-baseline gap-2 overflow-hidden font-medium"
        aria-label={headerAccessibleTitle}
      >
        <span
          class="shrink-0 overflow-hidden truncate whitespace-nowrap transition-all duration-500 ease-in-out {isSubslideshowActive
            ? 'max-w-0 -translate-x-6 opacity-0'
            : 'max-w-[45%] translate-x-0 opacity-100'}"
          title={headerTitle}
        >
          {headerTitle}
        </span>
        {#if headerSubTitle}
          <span
            class="shrink-0 transition-opacity duration-300 {isSubslideshowActive
              ? 'opacity-0'
              : 'opacity-45'}"
          >
            /
          </span>
          <span
            class="shrink-0 truncate transition-all duration-500 ease-in-out {isSubslideshowActive
              ? 'max-w-[55%] -translate-x-2 opacity-100'
              : 'max-w-[35%] translate-x-0 opacity-75'}"
            title={headerSubTitle}
          >
            {headerSubTitle}
          </span>
        {/if}
        {#if showHeaderChapterTitle}
          <span class="shrink-0 opacity-45">/</span>
          <span class="min-w-0 truncate opacity-75" title={headerChapterTitle}>
            {headerChapterTitle}
          </span>
        {/if}
      </div>

      <button
        type="button"
        class="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        aria-label={tocOpen ? "Close table of contents" : "Open table of contents"}
        aria-expanded={tocOpen}
        title={tocOpen ? "Close table of contents" : "Open table of contents"}
        onclick={toggleToc}
      >
        {#if tocOpen}
          <X size={18} aria-hidden="true" />
        {:else}
          <ListTree size={18} aria-hidden="true" />
        {/if}
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-clip">
      <div
        class="flex h-full w-[200%] {isSubslideshowActive
          ? '-translate-x-1/2'
          : 'translate-x-0'} transition-transform duration-500 ease-in-out motion-reduce:transition-none"
      >
        <SlideshowPanel
          class="h-full w-1/2 shrink-0"
          {project}
          slideshow={rootSlideshow}
          {rootSlideshow}
          active={!isSubslideshowActive}
          tocOpen={tocOpen && !isSubslideshowActive}
          onTocClose={closeToc}
          onIndexChange={(index) => (mainIndex = index)}
        />

        <div class="h-full min-h-0 w-1/2 shrink-0">
          {#if subslideshow}
            {#key subslideshow.id}
              <SlideshowPanel
                class="h-full"
                {project}
                slideshow={subslideshow}
                {rootSlideshow}
                active={isSubslideshowActive}
                tocOpen={tocOpen && isSubslideshowActive}
                onTocClose={closeToc}
                onIndexChange={(index) => (subslideshowIndex = index)}
              />
            {/key}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>
