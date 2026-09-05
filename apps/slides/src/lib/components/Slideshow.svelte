<script lang="ts">
  import { onMount, setContext, tick } from "svelte";
  import {
    ArrowLeft,
    Layers as LayersIcon,
    ListTree,
    Moon,
    Sun,
    X,
  } from "@lucide/svelte";
  import type { PaddingOptions } from "maplibre-gl";

  import Map from "$lib/components/Map.svelte";
  import PanelOverlayToggle from "$lib/components/PanelOverlayToggle.svelte";
  import SlideshowLayers from "$lib/components/SlideshowLayers.svelte";
  import SlideshowPanel from "$lib/components/SlideshowPanel.svelte";
  import SlideshowToc from "$lib/components/SlideshowToc.svelte";
  import { getGeoJsonLayers } from "$lib/shared/geojson";
  import { getSlideshowRouteHref } from "$lib/shared/projects";
  import { DEFAULT_DURATION, DEFAULT_PADDING } from "$lib/shared/settings";
  import type { Project, Slideshow } from "$lib/shared/types";

  type Props = {
    project: Project;
    slideshow: Slideshow;
    mainSlideshow?: Slideshow;
  };

  type SlideshowPanelHandle = {
    scrollToChapter: (
      slug: string,
      behavior?: ScrollBehavior,
    ) => Promise<void>;
    scrollToTop: (behavior?: ScrollBehavior) => void;
  };

  const PANEL_TRANSITION_MS = 500;
  const PANEL_HEADER_HEIGHT = "52px";
  const PANEL_OVERLAY_OVERLAP = "0.625rem";
  const LAYER_HIGHLIGHT_ENABLED = false;
  const THEME_STORAGE_KEY = "slides-theme";

  type ThemePreference = "light" | "dark";
  type PanelOverlayName = "toc" | "layers";

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
  let activePanelOverlay: PanelOverlayName | undefined = $state(undefined);
  let highlightedWarpedMapUrl: string | undefined = $state(undefined);
  let hiddenWarpedMapUrls: string[] = $state([]);
  let zoomToWarpedMapUrl: string | undefined = $state(undefined);
  let zoomToWarpedMapSignal: number = $state(0);
  let scrollToTopSignal: number = $state(0);
  let mapResetSignal: number = $state(0);
  let panelElement: HTMLDivElement | undefined = $state();
  let mainPanel: SlideshowPanelHandle | undefined = $state();
  let subslideshowPanel: SlideshowPanelHandle | undefined = $state();
  let mapLayoutRevision: number = $state(0);
  let mapPadding: PaddingOptions = $state({
    top: DEFAULT_PADDING,
    right: DEFAULT_PADDING,
    bottom: DEFAULT_PADDING,
    left: DEFAULT_PADDING,
  });
  let themePreference: ThemePreference | undefined = $state(undefined);

  const clampIndex = (index: number, length: number) =>
    length > 0 ? Math.min(Math.max(index, 0), length - 1) : 0;

  const layers = $derived(Object.entries(sources).flatMap(([sourceId, source]) =>
    source.type === "geojson" ? getGeoJsonLayers(sourceId, "visible") : [],
  ));

  const firstChapter = $derived(chapters[0]);
  const mapKey = $derived(`${project.slug}:${isDarkMode}`);
  const activeIndex = $derived.by(() =>
    clampIndex(
      isSubslideshowActive ? subslideshowIndex : mainIndex,
      chapters.length,
    ),
  );
  const activeChapter = $derived(chapters[activeIndex]);
  const headerTitle = $derived(rootSlideshow.title);
  const headerSubTitle = $derived(
    isSubslideshowActive ? activeSlideshow.title : undefined,
  );
  const headerChapterTitle = $derived(activeChapter?.title);
  const headerActiveTitle = $derived(headerSubTitle ?? headerTitle);
  const tocOpen = $derived(activePanelOverlay === "toc");
  const layersOpen = $derived(activePanelOverlay === "layers");
  const panelOverlayOpen = $derived(activePanelOverlay !== undefined);
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
  const themeToggleLabel = $derived(
    isDarkMode ? "Switch to light theme" : "Switch to dark theme",
  );
  const layersToggleLabel = $derived(
    layersOpen ? "Close map layers" : "Open map layers",
  );
  const tocOverlayTop = $derived(
    `calc(${PANEL_HEADER_HEIGHT} - ${PANEL_OVERLAY_OVERLAP})`,
  );

  const parseThemePreference = (
    value: string | null,
  ): ThemePreference | undefined =>
    value === "light" || value === "dark" ? value : undefined;

  const closeToc = () => {
    if (tocOpen) {
      activePanelOverlay = undefined;
    }
  };

  const clearWarpedMapHighlight = () => {
    highlightedWarpedMapUrl = undefined;
  };

  const resetWarpedMapVisibility = () => {
    hiddenWarpedMapUrls = [];
  };

  const closePanelOverlays = () => {
    if (layersOpen) {
      clearWarpedMapHighlight();
    }

    activePanelOverlay = undefined;
  };

  const toggleToc = () => {
    const wasLayersOpen = layersOpen;
    activePanelOverlay = tocOpen ? undefined : "toc";

    if (wasLayersOpen) {
      clearWarpedMapHighlight();
    }
  };

  const toggleLayers = () => {
    if (layersOpen) {
      activePanelOverlay = undefined;
      clearWarpedMapHighlight();
      return;
    }

    activePanelOverlay = "layers";
  };

  const toggleTheme = () => {
    const nextIsDarkMode = !(isDarkMode ?? false);
    themePreference = nextIsDarkMode ? "dark" : "light";
    isDarkMode = nextIsDarkMode;

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    } catch {
      // Persisting theme preference is a convenience, not required.
    }
  };

  const scrollActivePanelToTop = () => {
    closePanelOverlays();
    scrollToTopSignal += 1;
  };

  const resetActiveSlideView = () => {
    closePanelOverlays();
    clearWarpedMapHighlight();
    resetWarpedMapVisibility();
    mapResetSignal += 1;
  };

  const waitForNextFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const scrollActivePanelToChapter = async (slug: string) => {
    closePanelOverlays();
    await tick();
    await waitForNextFrame();
    await (isSubslideshowActive ? subslideshowPanel : mainPanel)
      ?.scrollToChapter(slug);
  };

  const jumpToMainStart = () => {
    closePanelOverlays();
    mainIndex = 0;
    resetWarpedMapVisibility();
    scrollToTopSignal += 1;
    mapResetSignal += 1;
  };

  const highlightWarpedMap = (url?: string) => {
    if (!LAYER_HIGHLIGHT_ENABLED) return;

    highlightedWarpedMapUrl = url;
  };

  const toggleWarpedMapVisibility = (url: string) => {
    const isHidden = hiddenWarpedMapUrls.includes(url);

    clearWarpedMapHighlight();

    hiddenWarpedMapUrls = isHidden
      ? hiddenWarpedMapUrls.filter((hiddenUrl) => hiddenUrl !== url)
      : [...hiddenWarpedMapUrls, url];

    if (isHidden && LAYER_HIGHLIGHT_ENABLED) {
      highlightedWarpedMapUrl = url;
    }
  };

  const zoomToWarpedMapBounds = (url: string) => {
    if (LAYER_HIGHLIGHT_ENABLED) {
      highlightedWarpedMapUrl = url;
    }

    zoomToWarpedMapUrl = url;
    zoomToWarpedMapSignal += 1;
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
    activePanelOverlay = undefined;
    clearWarpedMapHighlight();

    if (isSubslideshowActive) {
      subslideshowIndex = 0;
    }
  });

  onMount(() => {
    let media: MediaQueryList | undefined;
    let panelObserver: ResizeObserver | undefined;
    let layoutFrame: number | undefined;
    let mapLayoutTimeout: number | undefined;

    const handleMediaChange = (event: MediaQueryListEvent) => {
      if (!themePreference) {
        isDarkMode = event.matches;
      }
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
      themePreference = parseThemePreference(
        window.localStorage.getItem(THEME_STORAGE_KEY),
      );
      media = window.matchMedia("(prefers-color-scheme: dark)");
      isDarkMode = themePreference ? themePreference === "dark" : media.matches;
      media.addEventListener("change", handleMediaChange);
    } catch {
      isDarkMode = themePreference === "dark";
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
  class="relative h-app-screen w-screen overflow-hidden bg-white dark:bg-black {isDarkMode
    ? 'dark'
    : ''}"
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
          resetSignal={mapResetSignal}
          padding={mapPadding}
          highlight={highlightedWarpedMapUrl}
          {hiddenWarpedMapUrls}
          {zoomToWarpedMapUrl}
          {zoomToWarpedMapSignal}
        />
      {/key}
    {/if}
  </div>

  <div class="pointer-events-none absolute inset-0 z-10">
    {#if isSubslideshowActive}
      <a
        class="pointer-events-auto absolute top-3 left-3 flex min-h-[52px] max-w-[calc(100vw-12rem)] items-center rounded-lg bg-[var(--app-map-control-bg)] px-4 py-2 text-left text-[28px] leading-[1.1] font-normal text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md sm:top-4 sm:left-4 md:top-5 md:left-5 md:max-w-[28rem]"
        href={mainHref}
        title={rootSlideshow.title}
        onclick={jumpToMainStart}
      >
        <span class="block translate-y-[0.06em] truncate">{rootSlideshow.title}</span>
      </a>
    {:else}
      <button
        type="button"
        class="pointer-events-auto absolute top-3 left-3 flex min-h-[52px] max-w-[calc(100vw-12rem)] cursor-pointer items-center rounded-lg bg-[var(--app-map-control-bg)] px-4 py-2 text-left text-[28px] leading-[1.1] font-normal text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md sm:top-4 sm:left-4 md:top-5 md:left-5 md:max-w-[28rem]"
        title={rootSlideshow.title}
        onclick={jumpToMainStart}
      >
        <span class="block translate-y-[0.06em] truncate">{rootSlideshow.title}</span>
      </button>
    {/if}

    <div
      bind:this={panelElement}
      class="pointer-events-auto absolute right-3 bottom-3 flex h-[calc((100dvh-1.5rem)/2)] max-h-full min-h-0 w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg bg-[var(--app-panel-bg)] text-[var(--app-text)] shadow-2xl backdrop-blur-md transition-none ease-in-out sm:right-4 sm:bottom-4 sm:h-[calc((100dvh-2rem)/2)] sm:w-[calc(100vw-2rem)] md:right-5 md:bottom-5 md:h-[calc(100dvh-2.5rem)] md:w-[480px] md:transition-[right,bottom,width,height] md:duration-500 motion-reduce:transition-none xl:w-[600px]"
    >
      <header
        class="relative z-30 flex h-[52px] shrink-0 items-center gap-2 bg-[var(--app-panel-header-bg)] px-5 text-[16px] leading-[1.1] font-medium text-[var(--app-breadcrumb)] backdrop-blur"
      >
        {#if isSubslideshowActive}
          <a
            class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--app-icon)] hover:bg-[var(--app-hover-bg)]"
            href={mainBreadcrumbHref}
            aria-label={`Back to ${rootSlideshow.title}`}
            title={`Back to ${rootSlideshow.title}`}
            onclick={closePanelOverlays}
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
              class="max-w-[45%] shrink-0 translate-y-[0.14em] cursor-pointer overflow-hidden truncate whitespace-nowrap p-0 text-left"
              aria-label={`Scroll ${headerTitle} to top`}
              tabindex={isSubslideshowActive ? -1 : undefined}
              title={headerTitle}
              onclick={scrollActivePanelToTop}
            >
              {headerTitle}
            </button>

            {#if showHeaderChapterTitle}
              <span class="ml-2 shrink-0 translate-y-[0.14em] text-[var(--app-icon)]">/</span>
              <button
                type="button"
                class="ml-2 min-w-0 translate-y-[0.14em] cursor-pointer overflow-hidden truncate p-0 text-left opacity-75"
                aria-label={`Reset map view for ${headerChapterTitle}`}
                tabindex={isSubslideshowActive ? -1 : undefined}
                title={headerChapterTitle}
                onclick={resetActiveSlideView}
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
                class="max-w-[55%] shrink-0 translate-y-[0.14em] cursor-pointer overflow-hidden truncate whitespace-nowrap p-0 text-left"
                aria-label={`Scroll ${headerSubTitle} to top`}
                tabindex={isSubslideshowActive ? undefined : -1}
                title={headerSubTitle}
                onclick={scrollActivePanelToTop}
              >
                {headerSubTitle}
              </button>
            {/if}

            {#if showHeaderChapterTitle}
              <span class="ml-2 shrink-0 translate-y-[0.14em] text-[var(--app-icon)]">/</span>
              <button
                type="button"
                class="ml-2 min-w-0 translate-y-[0.14em] cursor-pointer overflow-hidden truncate p-0 text-left opacity-75"
                aria-label={`Reset map view for ${headerChapterTitle}`}
                tabindex={isSubslideshowActive ? undefined : -1}
                title={headerChapterTitle}
                onclick={resetActiveSlideView}
              >
                {headerChapterTitle}
              </button>
            {/if}
          </div>
        </div>

        <button
          type="button"
          class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--app-icon)] hover:bg-[var(--app-hover-bg)]"
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
          onclick={toggleTheme}
        >
          {#if isDarkMode}
            <Sun size={18} aria-hidden="true" />
          {:else}
            <Moon size={18} aria-hidden="true" />
          {/if}
        </button>

        <PanelOverlayToggle
          active={tocOpen}
          aria-label={tocOpen ? "Close table of contents" : "Open table of contents"}
          title={tocOpen ? "Close table of contents" : "Open table of contents"}
          onclick={toggleToc}
        >
          {#if tocOpen}
            <X size={18} aria-hidden="true" />
          {:else}
            <ListTree size={18} aria-hidden="true" />
          {/if}
        </PanelOverlayToggle>

        <PanelOverlayToggle
          active={layersOpen}
          aria-label={layersToggleLabel}
          title={layersToggleLabel}
          onclick={toggleLayers}
        >
          {#if layersOpen}
            <X size={18} aria-hidden="true" />
          {:else}
            <LayersIcon size={18} aria-hidden="true" />
          {/if}
        </PanelOverlayToggle>
      </header>

      {#if panelOverlayOpen}
        <button
          type="button"
          class="absolute inset-x-0 top-[52px] bottom-0 z-20 cursor-default bg-transparent p-0 focus:outline-none"
          aria-label="Close panel overlay"
          tabindex="-1"
          onclick={closePanelOverlays}
        ></button>
      {/if}

      <div class="min-h-0 flex-1 overflow-hidden">
        <div
          class="flex h-full w-[200%] transition-transform duration-500 ease-in-out motion-reduce:transition-none"
          style={`transform: translateX(${isSubslideshowActive ? "-50%" : "0"});`}
        >
          <SlideshowPanel
            bind:this={mainPanel}
            class="h-full w-1/2 shrink-0"
            {project}
            slideshow={rootSlideshow}
            active={!isSubslideshowActive}
            overlayOpen={panelOverlayOpen && !isSubslideshowActive}
            {scrollToTopSignal}
            onTocClose={closeToc}
            onIndexChange={(index) => (mainIndex = index)}
          />

          <div class="h-full min-h-0 w-1/2 shrink-0">
            {#if subslideshow}
              {#key subslideshow.id}
                <SlideshowPanel
                  bind:this={subslideshowPanel}
                  class="h-full"
                  {project}
                  slideshow={subslideshow}
                  active={isSubslideshowActive}
                  overlayOpen={panelOverlayOpen && isSubslideshowActive}
                  {scrollToTopSignal}
                  onTocClose={closeToc}
                  onIndexChange={(index) => (subslideshowIndex = index)}
                />
              {/key}
            {/if}
          </div>
        </div>
      </div>

      {#if tocOpen}
        <SlideshowToc
          {project}
          slideshow={activeSlideshow}
          {rootSlideshow}
          currentSlug={activeChapter?.slug}
          top={tocOverlayTop}
          onClose={closeToc}
          onSelectLocalChapter={scrollActivePanelToChapter}
        />
      {:else if layersOpen}
        <SlideshowLayers
          chapter={activeChapter}
          {hiddenWarpedMapUrls}
          {highlightedWarpedMapUrl}
          highlightEnabled={LAYER_HIGHLIGHT_ENABLED}
          top={tocOverlayTop}
          onToggleVisibility={toggleWarpedMapVisibility}
          onZoomToBounds={zoomToWarpedMapBounds}
          onHighlight={highlightWarpedMap}
        />
      {/if}
    </div>
  </div>
</div>
