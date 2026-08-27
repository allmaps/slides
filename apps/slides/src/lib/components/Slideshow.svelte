<script lang="ts">
  import { onMount, setContext } from "svelte";
  import { ArrowLeft, ListTree, X } from "@lucide/svelte";
  import type { PaddingOptions } from "maplibre-gl";

  import Map from "$lib/components/Map.svelte";
  import SlideshowPanel from "$lib/components/SlideshowPanel.svelte";
  import { getGeoJsonLayers } from "$lib/shared/geojson";
  import { getSlideshowRouteHref } from "$lib/shared/projects";
  import { DEFAULT_DURATION, DEFAULT_PADDING } from "$lib/shared/settings";
  import type { Project, Slideshow } from "$lib/shared/types";

  type Props = {
    project: Project;
    slideshow: Slideshow;
    mainSlideshow?: Slideshow;
  };

  const PANEL_TRANSITION_MS = 500;

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
  let scrollToTopSignal: number = $state(0);
  let panelElement: HTMLDivElement | undefined = $state();
  let mapLayoutRevision: number = $state(0);
  let mapPadding: PaddingOptions = $state({
    top: DEFAULT_PADDING,
    right: DEFAULT_PADDING,
    bottom: DEFAULT_PADDING,
    left: DEFAULT_PADDING,
  });

  const layers = $derived(Object.entries(sources).flatMap(([sourceId, source]) =>
    source.type === "geojson" ? getGeoJsonLayers(sourceId, "visible") : [],
  ));

  const firstChapter = $derived(chapters[0]);
  const mapKey = $derived(`${project.slug}:${isDarkMode}`);
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

  const scrollActivePanelToTop = () => {
    closeToc();
    scrollToTopSignal += 1;
  };

  const samePadding = (a: PaddingOptions, b: PaddingOptions) =>
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left;
  const isWideLayout = () => window.matchMedia("(min-width: 768px)").matches;

  const updateMapLayout = () => {
    if (!panelElement) return;

    const rect = panelElement.getBoundingClientRect();
    const nextPadding = isWideLayout()
      ? {
          top: DEFAULT_PADDING,
          right: Math.max(
            DEFAULT_PADDING,
            Math.ceil(window.innerWidth - rect.left + DEFAULT_PADDING),
          ),
          bottom: DEFAULT_PADDING,
          left: DEFAULT_PADDING,
        }
      : {
          top: DEFAULT_PADDING,
          right: DEFAULT_PADDING,
          bottom: Math.max(
            DEFAULT_PADDING,
            Math.ceil(window.innerHeight - rect.top + DEFAULT_PADDING),
          ),
          left: DEFAULT_PADDING,
        };

    if (!samePadding(mapPadding, nextPadding)) {
      mapPadding = nextPadding;
    }

    mapLayoutRevision += 1;
  };

  $effect(() => {
    activeSlideshow.id;
    closeToc();
  });

  onMount(() => {
    let media: MediaQueryList | undefined;
    let panelObserver: ResizeObserver | undefined;
    let layoutFrame: number | undefined;
    let mapLayoutTimeout: number | undefined;

    const handleMediaChange = (event: MediaQueryListEvent) => {
      isDarkMode = event.matches;
    };
    const queueImmediateMapLayoutUpdate = () => {
      if (layoutFrame !== undefined) return;

      layoutFrame = requestAnimationFrame(() => {
        layoutFrame = undefined;
        updateMapLayout();
      });
    };
    const queueSettledMapLayoutUpdate = () => {
      if (mapLayoutTimeout !== undefined) {
        window.clearTimeout(mapLayoutTimeout);
        mapLayoutTimeout = undefined;
      }

      if (!isWideLayout()) {
        queueImmediateMapLayoutUpdate();
        return;
      }

      mapLayoutTimeout = window.setTimeout(() => {
        mapLayoutTimeout = undefined;
        queueImmediateMapLayoutUpdate();
      }, PANEL_TRANSITION_MS);
    };
    const handlePanelTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== panelElement) return;
      if (
        !["width", "height", "right", "bottom"].includes(event.propertyName)
      ) {
        return;
      }

      if (mapLayoutTimeout !== undefined) {
        window.clearTimeout(mapLayoutTimeout);
        mapLayoutTimeout = undefined;
      }

      queueImmediateMapLayoutUpdate();
    };

    try {
      media = window.matchMedia("(prefers-color-scheme: dark)");
      isDarkMode = media.matches;
      media.addEventListener("change", handleMediaChange);
    } catch {
      isDarkMode = false;
    }

    if (panelElement) {
      panelObserver = new ResizeObserver(queueSettledMapLayoutUpdate);
      panelObserver.observe(panelElement);
      panelElement.addEventListener("transitionend", handlePanelTransitionEnd);
    }

    window.addEventListener("resize", queueSettledMapLayoutUpdate);
    queueImmediateMapLayoutUpdate();

    return () => {
      media?.removeEventListener("change", handleMediaChange);
      panelObserver?.disconnect();
      panelElement?.removeEventListener(
        "transitionend",
        handlePanelTransitionEnd,
      );
      window.removeEventListener("resize", queueSettledMapLayoutUpdate);

      if (layoutFrame !== undefined) {
        cancelAnimationFrame(layoutFrame);
      }
      if (mapLayoutTimeout !== undefined) {
        window.clearTimeout(mapLayoutTimeout);
      }
    };
  });
</script>

<svelte:head>
  <title>{activeSlideshow.title}</title>
  <meta name="description" content={firstChapter?.description ?? project.description} />
</svelte:head>

<div
  class="relative h-app-screen w-screen overflow-hidden bg-white dark:bg-black"
>
  <div class="absolute inset-0 z-0 min-h-0">
    {#if isDarkMode !== undefined}
      {#key mapKey}
        <Map
          {chapters}
          index={activeIndex}
          {isDarkMode}
          {sources}
          {layers}
          anticipate
          duration={DEFAULT_DURATION}
          layoutRevision={mapLayoutRevision}
          padding={mapPadding}
        />
      {/key}
    {/if}
  </div>

  <div class="pointer-events-none absolute inset-0 z-10">
    <div
      bind:this={panelElement}
      class="pointer-events-auto absolute right-3 bottom-3 flex h-[calc((100dvh-1.5rem)/2)] max-h-full min-h-0 w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-black/10 bg-white/85 text-black shadow-2xl backdrop-blur-md transition-none ease-in-out dark:border-white/15 dark:bg-black/85 dark:text-white sm:right-4 sm:bottom-4 sm:h-[calc((100dvh-2rem)/2)] sm:w-[calc(100vw-2rem)] md:right-5 md:bottom-5 md:h-[calc(100dvh-2.5rem)] md:w-[480px] md:transition-[right,bottom,width,height] md:duration-500 motion-reduce:transition-none xl:w-[600px]"
    >
      <header
        class="relative z-30 flex h-12 shrink-0 items-center gap-2 border-b border-black/10 bg-white/90 px-5 text-sm text-black backdrop-blur dark:border-white/15 dark:bg-black/90 dark:text-white"
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
          class="relative h-5 min-w-0 flex-1 overflow-hidden font-medium"
          aria-label={headerAccessibleTitle}
        >
          <div
            class="absolute inset-0 flex min-w-0 items-baseline overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none {isSubslideshowActive
              ? 'pointer-events-none -translate-y-1 opacity-0'
              : 'translate-y-0 opacity-100'}"
            aria-hidden={isSubslideshowActive}
          >
            <button
              type="button"
              class="max-w-[45%] shrink-0 cursor-pointer overflow-hidden truncate whitespace-nowrap p-0 text-left"
              aria-label={`Scroll ${headerTitle} to top`}
              tabindex={isSubslideshowActive ? -1 : undefined}
              title={headerTitle}
              onclick={scrollActivePanelToTop}
            >
              {headerTitle}
            </button>

            {#if showHeaderChapterTitle}
              <span class="ml-2 shrink-0 opacity-45">/</span>
              <button
                type="button"
                class="ml-2 min-w-0 cursor-pointer overflow-hidden truncate p-0 text-left opacity-75"
                aria-label={`${tocOpen ? "Close" : "Open"} table of contents for ${headerChapterTitle}`}
                aria-expanded={tocOpen}
                tabindex={isSubslideshowActive ? -1 : undefined}
                title={headerChapterTitle}
                onclick={toggleToc}
              >
                {headerChapterTitle}
              </button>
            {/if}
          </div>

          <div
            class="absolute inset-0 flex min-w-0 items-baseline overflow-hidden transition-all duration-300 ease-in-out motion-reduce:transition-none {isSubslideshowActive
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none translate-y-1 opacity-0'}"
            aria-hidden={!isSubslideshowActive}
          >
            {#if headerSubTitle}
              <button
                type="button"
                class="max-w-[55%] shrink-0 cursor-pointer overflow-hidden truncate whitespace-nowrap p-0 text-left"
                aria-label={`Scroll ${headerSubTitle} to top`}
                tabindex={isSubslideshowActive ? undefined : -1}
                title={headerSubTitle}
                onclick={scrollActivePanelToTop}
              >
                {headerSubTitle}
              </button>
            {/if}

            {#if showHeaderChapterTitle}
              <span class="ml-2 shrink-0 opacity-45">/</span>
              <button
                type="button"
                class="ml-2 min-w-0 cursor-pointer overflow-hidden truncate p-0 text-left opacity-75"
                aria-label={`${tocOpen ? "Close" : "Open"} table of contents for ${headerChapterTitle}`}
                aria-expanded={tocOpen}
                tabindex={isSubslideshowActive ? undefined : -1}
                title={headerChapterTitle}
                onclick={toggleToc}
              >
                {headerChapterTitle}
              </button>
            {/if}
          </div>
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
            {scrollToTopSignal}
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
                  {scrollToTopSignal}
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
</div>
