<script lang="ts">
  import { goto } from "$app/navigation";
  import { provideInterfaceText } from "$lib/shared/interface-context";
  import { slideshowShortcut } from "$lib/shared/keyboard";
  import { dev } from "$app/environment";
  import { page } from "$app/state";
  import { onMount, tick, untrack } from "svelte";
  import type { PaddingOptions } from "maplibre-gl";

  import { emptyThumbnails, type ThumbnailManifest } from "$lib/shared/thumbnails";

  import Map from "$lib/components/Map.svelte";
  import MobilePanelHandle from "$lib/components/MobilePanelHandle.svelte";
  import PanelOverlay from "$lib/components/PanelOverlay.svelte";
  import SlideshowNavigator from "$lib/components/SlideshowNavigator.svelte";
  import SlideshowLayers from "$lib/components/SlideshowLayers.svelte";
  import SlideshowPanel from "$lib/components/SlideshowPanel.svelte";
  import SlideshowSeo from "$lib/components/SlideshowSeo.svelte";
  import SlideshowToc from "$lib/components/SlideshowToc.svelte";
  import StartScreen from "$lib/components/StartScreen.svelte";
  import { getGeoJsonLayers } from "$lib/shared/geojson";
  import type { MobilePanelSize } from "$lib/shared/mobile-panel";
  import {
    getChapterRouteHref,
    getSlideshowRouteHref,
  } from "$lib/shared/project";
  import { DEFAULT_DURATION, DEFAULT_PADDING } from "$lib/shared/settings";
  import type {
    MapChapter,
    MapChapterProps,
    Project,
    Slideshow,
  } from "$lib/shared/types";

  type Props = {
    thumbnails?: ThumbnailManifest;
    project: Project;
    slideshow: Slideshow;
    mainSlideshow?: Slideshow;
    debug?: boolean;
  };

  type SlideshowPanelHandle = {
    scrollToChapter: (
      slug: string,
      behavior?: ScrollBehavior,
    ) => Promise<void>;
    scrollToTop: (behavior?: ScrollBehavior) => void;
  };

  const PANEL_TRANSITION_MS = 550;
  const PANEL_OUTSET = 8;
  const NAVIGATOR_HEIGHT = 62;
  const PANEL_HANDLE_HEIGHT = 36;
  const PANEL_NAVIGATOR_SPACE = `var(--panel-overlay-clearance, ${NAVIGATOR_HEIGHT + 6}px)`;
  const LAYER_HIGHLIGHT_ENABLED = false;
  const THEME_STORAGE_KEY = "slides-theme";

  type ThemePreference = "light" | "dark";
  type PanelOverlayName = "toc" | "layers" | "credits";

  let { project, slideshow, mainSlideshow, debug = dev, thumbnails = emptyThumbnails() }: Props = $props();

  const t = provideInterfaceText(() => project.interface);

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
  let subslideshowIndexOwner: string | undefined = $state(undefined);
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
  let mainSlideshowStarted = $state(false);
  let panelVisible = $state(true);
  let mobilePanelExpanded = $state(false);
  let mobileDragHeight: number | undefined = $state();
  let mobileDragging = $state(false);
  let mobileResizing = $state(false);
  let mobileResizeTimeout: ReturnType<typeof setTimeout> | undefined;
  const mobilePanelSize = $derived<MobilePanelSize>(
    !panelVisible ? "collapsed" : mobilePanelExpanded ? "full" : "half",
  );

  const clampIndex = (index: number, length: number) =>
    length > 0 ? Math.min(Math.max(index, 0), length - 1) : 0;

  const layers = $derived(Object.entries(sources).flatMap(([sourceId, source]) =>
    source.type === "geojson" ? getGeoJsonLayers(sourceId, "visible") : [],
  ));

  const firstChapter = $derived(chapters[0]);
  const socialImage = $derived(thumbnails.social[activeSlideshow.id]);
  const startMapSettings = $derived<MapChapterProps>(
    activeSlideshow.start ?? firstChapter ?? {},
  );
  const mapChapters = $derived([startMapSettings, ...chapters]);
  const startScreenVisible = $derived(
    activeSlideshow.id === project.main && !mainSlideshowStarted,
  );
  const startDescription = $derived(
    activeSlideshow.description ??
      (activeSlideshow.id === project.main ? project.description : undefined),
  );
  const activeIndex = $derived.by(() =>
    clampIndex(
      isSubslideshowActive
        ? subslideshowIndexOwner === activeSlideshow.id
          ? subslideshowIndex
          : 0
        : mainIndex,
      chapters.length,
    ),
  );
  const mapIndex = $derived(startScreenVisible ? 0 : activeIndex + 1);
  const effectiveMapPadding = $derived(
    startScreenVisible ? DEFAULT_PADDING : mapPadding,
  );
  const activeChapter = $derived(chapters[activeIndex]);
  const tocOpen = $derived(activePanelOverlay === "toc");
  const layersOpen = $derived(activePanelOverlay === "layers");
  const creditsOpen = $derived(activePanelOverlay === "credits");
  const CreditsComponent = $derived(activeSlideshow.CreditsComponent);
  const SharedCredits = $derived(project.CreditsComponent);
  const creditsTitle = $derived((SharedCredits ? project.creditsTitle : activeSlideshow.creditsTitle) ?? t("credits"));
  const panelOverlayOpen = $derived(activePanelOverlay !== undefined);
  const mainHref = $derived(getSlideshowRouteHref(rootSlideshow));
  const mainBreadcrumbHref = $derived.by(() => {
    const chapter = rootSlideshow.chapters[mainIndex];
    return chapter ? getChapterRouteHref(rootSlideshow, chapter) : mainHref;
  });
  $effect(() => {
    if (isDarkMode === undefined) return;
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = isDarkMode ? "dark" : "light";
    return () => {
      if (previous === undefined) delete root.dataset.theme;
      else root.dataset.theme = previous;
    };
  });
  const parseThemePreference = (
    value: string | null,
  ): ThemePreference | undefined =>
    value === "light" || value === "dark" ? value : undefined;

  const decodeHash = (hash: string) => {
    const value = hash.startsWith("#") ? hash.slice(1) : hash;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const initializeIndexFromHash = () => {
    const hash = decodeHash(window.location.hash);
    if (!hash) return;

    const initialIndex = activeSlideshow.chapters.findIndex(
      (chapter) => chapter.slug === hash,
    );
    if (initialIndex < 0) return;

    if (activeSlideshow.id === project.main) {
      mainSlideshowStarted = true;
    }

    if (isSubslideshowActive) {
      subslideshowIndexOwner = activeSlideshow.id;
      subslideshowIndex = initialIndex;
    } else {
      mainIndex = initialIndex;
    }
  };

  const getSlideData = ({ Component: _Component, ...slideData }: MapChapter) =>
    slideData;

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

  const togglePanel = () => { closePanelOverlays(); panelVisible = !panelVisible; };
  const showChapterLayers = async (slug: string) => {
    await scrollActivePanelToChapter(slug);
    activePanelOverlay = "layers";
  };

  const handleKeyboard = (event: KeyboardEvent) => {
    if (event.key === "Escape" && panelOverlayOpen) {
      event.preventDefault();
      closePanelOverlays();
      return;
    }
    const target = event.target instanceof Element ? event.target : undefined;
    const blocked = startScreenVisible || !!document.querySelector('dialog[open]') || !!target?.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], .maplibregl-canvas',
    );
    const action = slideshowShortcut({ ...event, key: event.key, altKey: event.altKey, ctrlKey: event.ctrlKey,
      metaKey: event.metaKey, shiftKey: event.shiftKey, defaultPrevented: event.defaultPrevented, blocked });
    if (!action) return;
    if (action === "back" && !isSubslideshowActive) return;
    event.preventDefault();
    if (action === "togglePanel") togglePanel();
    else if (action === "back") void goto(mainBreadcrumbHref);
    else {
      const chapter = chapters[activeIndex + (action === "next" ? 1 : -1)];
      if (chapter) void scrollActivePanelToChapter(chapter.slug);
    }
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

  const waitForNextFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const scrollActivePanelToChapter = async (slug: string) => {
    closePanelOverlays();
    await tick();
    await waitForNextFrame();
    await (isSubslideshowActive ? subslideshowPanel : mainPanel)
      ?.scrollToChapter(slug, panelVisible ? "smooth" : "auto");
  };

  const jumpToMainStart = () => {
    closePanelOverlays();
    mainIndex = 0;
    resetWarpedMapVisibility();
    scrollToTopSignal += 1;
    mapResetSignal += 1;
  };

  const startSlideshow = () => {
    closePanelOverlays();
    clearWarpedMapHighlight();
    resetWarpedMapVisibility();

    if (isSubslideshowActive) {
      subslideshowIndexOwner = activeSlideshow.id;
      subslideshowIndex = 0;
    } else {
      mainIndex = 0;
    }

    scrollToTopSignal += 1;
    updateMapLayout();
    mainSlideshowStarted = true;
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

  const startMobileResize = () => {
    closePanelOverlays();
    clearTimeout(mobileResizeTimeout);
    mobileDragging = true;
    mobileResizing = true;
  };

  const snapMobilePanel = (size: MobilePanelSize) => {
    closePanelOverlays();
    clearTimeout(mobileResizeTimeout);
    mobileDragging = false;
    mobileResizing = true;
    panelVisible = size !== "collapsed";
    mobilePanelExpanded = size === "full";
    mobileDragHeight = undefined;
    mobileResizeTimeout = setTimeout(() => {
      mobileResizing = false;
      updateMapLayout();
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : PANEL_TRANSITION_MS);
  };

  const updateMapLayout = () => {
    if (!panelElement || mobileResizing) return;

    const panelStyle = window.getComputedStyle(panelElement);
    const rightInset = Number.parseFloat(panelStyle.right) || 0;
    const bottomInset = Number.parseFloat(panelStyle.bottom) || 0;
    const reservePanel = panelVisible;
    const nextPadding = isWideLayout()
      ? {
          top: DEFAULT_PADDING,
          right: Math.max(
            DEFAULT_PADDING,
            reservePanel ? Math.ceil(panelElement.offsetWidth + PANEL_OUTSET + rightInset + DEFAULT_PADDING) : DEFAULT_PADDING,
          ),
          bottom: DEFAULT_PADDING,
          left: DEFAULT_PADDING,
        }
      : {
          top: DEFAULT_PADDING,
          right: DEFAULT_PADDING,
          bottom: Math.max(
            DEFAULT_PADDING,
            // Keep a usable map viewport even when the reading panel is expanded.
            Math.min(
              Math.ceil((reservePanel ? panelElement.offsetHeight + PANEL_OUTSET : NAVIGATOR_HEIGHT + 20) + bottomInset + DEFAULT_PADDING),
              (panelElement.parentElement?.clientHeight ?? window.innerHeight) - DEFAULT_PADDING - 120,
            ),
          ),
          left: DEFAULT_PADDING,
        };

    if (!samePadding(mapPadding, nextPadding)) {
      mapPadding = nextPadding;
    }

    mapLayoutRevision += 1;
  };

  $effect(() => {
    panelVisible;
    tick().then(updateMapLayout);
  });

  $effect(() => {
    const slideshowId = activeSlideshow.id;
    // Changing chapters updates the hash too. Reset the subslideshow only
    // when its route changes, otherwise hidden-panel navigation loses its index.
    untrack(() => {
      activePanelOverlay = undefined;
      clearWarpedMapHighlight();
      if (isSubslideshowActive) {
        mainSlideshowStarted = true;
        subslideshowIndexOwner = slideshowId;
        subslideshowIndex = Math.max(0, chapters.findIndex(
          chapter => chapter.slug === decodeHash(page.url.hash),
        ));
      } else {
        subslideshowIndexOwner = undefined;
      }
    });
  });

  $effect(() => {
    const hash = decodeHash(page.url.hash);
    if (
      activeSlideshow.id === project.main &&
      hash &&
      activeSlideshow.chapters.some((chapter) => chapter.slug === hash)
    ) {
      mainSlideshowStarted = true;
    }

  });

  $effect(() => {
    if (!debug || !activeChapter) return;

    const hash = page.url.hash;
    const slideshowState = {
      id: activeSlideshow.id,
      slug: activeSlideshow.slug,
      path: activeSlideshow.path,
      title: activeSlideshow.title,
    };
    const slideState = {
      index: activeIndex,
      slug: activeChapter.slug,
      title: activeChapter.title,
    };
    const slideData = getSlideData(activeChapter);
    const reportTimeout = window.setTimeout(() => {
      console.log("Current slide state...", {
        hash,
        slideshow: slideshowState,
        slide: slideState,
        slideData,
      });
    });

    return () => window.clearTimeout(reportTimeout);
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

    initializeIndexFromHash();

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
      clearTimeout(mobileResizeTimeout);
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

<svelte:window onkeydown={handleKeyboard} />

<SlideshowSeo {project} slideshow={activeSlideshow} image={socialImage} />

<svelte:head>
  <!-- Before hydration, follow the system preference. Afterwards, use the same
       resolved theme as the interface, including a saved manual preference. -->
  <meta name="theme-color" content={isDarkMode ? "#000000" : "#ffffff"}
    media={isDarkMode === undefined ? "(prefers-color-scheme: light)" : undefined} />
  {#if isDarkMode === undefined}
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#000000" />
  {/if}
</svelte:head>

<div
  class="relative h-app-screen w-screen overflow-hidden bg-white dark:bg-black {isDarkMode
    ? 'dark'
    : ''}"
>
  <div class="absolute inset-0 z-0 min-h-0">
    {#if isDarkMode !== undefined}
      <Map
        annotationUrls={thumbnails.annotations}
        chapters={mapChapters}
        index={mapIndex}
        {isDarkMode}
        {sources}
        {layers}
        slideshowMapConfig={activeSlideshow.map}
        anticipate
        duration={DEFAULT_DURATION}
        layoutRevision={mapLayoutRevision}
        resetSignal={mapResetSignal}
        padding={effectiveMapPadding}
        controlsVisible={!startScreenVisible}
        highlight={highlightedWarpedMapUrl}
        {hiddenWarpedMapUrls}
        {zoomToWarpedMapUrl}
        {zoomToWarpedMapSignal}
        {debug}
      />
    {/if}
  </div>

  {#if isDarkMode !== undefined && activeSlideshow.id === project.main}
    <StartScreen
      title={activeSlideshow.title}
      description={startDescription}
      chapterCount={chapters.length}
      visible={startScreenVisible}
      {isDarkMode}
      onStart={startSlideshow}
    />
  {/if}

  <div
    class="pointer-events-none absolute inset-0 z-10"
    aria-hidden={startScreenVisible}
    inert={startScreenVisible}
  >
    {#if isSubslideshowActive}
      <a
        class="story-title pointer-events-auto absolute top-3 left-3 flex min-h-[52px] max-w-[calc(100vw-12rem)] items-center rounded-lg bg-[var(--app-map-control-bg)] px-4 py-2 text-left text-[28px] leading-[1.1] font-normal text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md sm:top-4 sm:left-4 md:top-5 md:left-5 md:max-w-[28rem]"
        class:story-title--hidden={startScreenVisible}
        href={mainHref}
        title={rootSlideshow.title}
        onclick={jumpToMainStart}
      >
        <span class="block translate-y-[0.06em] truncate">{rootSlideshow.title}</span>
      </a>
    {:else}
      <button
        type="button"
        class="story-title pointer-events-auto absolute top-3 left-3 flex min-h-[52px] max-w-[calc(100vw-12rem)] cursor-pointer items-center rounded-lg bg-[var(--app-map-control-bg)] px-4 py-2 text-left text-[28px] leading-[1.1] font-normal text-[var(--app-map-control-text)] shadow-2xl backdrop-blur-md sm:top-4 sm:left-4 md:top-5 md:left-5 md:max-w-[28rem]"
        class:story-title--hidden={startScreenVisible}
        title={rootSlideshow.title}
        onclick={jumpToMainStart}
      >
        <span class="block translate-y-[0.06em] truncate">{rootSlideshow.title}</span>
      </button>
    {/if}

    <div
      bind:this={panelElement}
      class="story-panel pointer-events-none absolute right-3 bottom-3 flex h-[calc((100dvh-1.5rem)/2)] max-h-full min-h-0 w-[calc(100vw-1.5rem)] flex-col text-[var(--app-text)] sm:right-4 sm:bottom-4 sm:h-[calc((100dvh-2rem)/2)] sm:w-[calc(100vw-2rem)] md:right-5 md:bottom-5 md:h-[calc(100dvh-2.5rem)] md:w-[480px] 2xl:w-[600px]"
      class:story-panel--hidden={startScreenVisible}
      class:story-panel--text-hidden={!panelVisible}
      class:story-panel--expanded={mobilePanelExpanded}
      class:story-panel--dragging={mobileDragging}
      data-panel-size={mobilePanelSize}
      style={`--panel-outset: ${PANEL_OUTSET}px; --navigator-height: ${NAVIGATOR_HEIGHT}px; --panel-handle-height: ${PANEL_HANDLE_HEIGHT}px;`}
      style:--mobile-panel-drag-height={mobileDragHeight === undefined ? undefined : `${mobileDragHeight}px`}
    >
      <div
        id="slideshow-reading-panel"
        class="reading-panel min-h-0 overflow-hidden rounded-[24px] bg-[var(--app-panel-bg)] shadow-2xl backdrop-blur-md"
        class:reading-panel--hidden={!panelVisible}
        aria-hidden={!panelVisible}
        inert={!panelVisible}
      >
        <!-- Anchor navigation must not scroll this viewport horizontally while
             the track translates. Only each panel's inner content should scroll. -->
        <div class="h-full min-h-0 overflow-clip">
          <div
            class="flex h-full w-[200%] transition-transform duration-500 ease-in-out motion-reduce:transition-none"
            style={`transform: translateX(${isSubslideshowActive ? "-50%" : "0"});`}
          >
            <SlideshowPanel
              {thumbnails}
              {isDarkMode}
              bind:this={mainPanel}
              class="h-full w-1/2 shrink-0"
              {project}
              slideshow={rootSlideshow}
              active={!isSubslideshowActive}
              suspended={!panelVisible || mobileResizing}
              overlayOpen={panelOverlayOpen && !isSubslideshowActive}
              {hiddenWarpedMapUrls}
              onShowLayers={showChapterLayers}
              {scrollToTopSignal}
              onTocClose={closeToc}
              onIndexChange={(index) => (mainIndex = index)}
            />

            <div class="h-full min-h-0 w-1/2 shrink-0">
              {#if subslideshow}
                {#key subslideshow.id}
                  <SlideshowPanel
                    {thumbnails}
                    {isDarkMode}
                    bind:this={subslideshowPanel}
                    class="h-full"
                    {project}
                    slideshow={subslideshow}
                    active={isSubslideshowActive}
                    suspended={!panelVisible || mobileResizing}
                    overlayOpen={panelOverlayOpen && isSubslideshowActive}
                    {hiddenWarpedMapUrls}
                    backHref={mainBreadcrumbHref}
                    backTitle={rootSlideshow.title}
                    onShowLayers={showChapterLayers}
                    {scrollToTopSignal}
                    onTocClose={closeToc}
                    onIndexChange={(index) => {
                      subslideshowIndexOwner = activeSlideshow.id;
                      subslideshowIndex = index;
                    }}
                  />
                {/key}
              {/if}
            </div>
          </div>
        </div>
      </div>

      <MobilePanelHandle
        panel={panelElement}
        size={mobilePanelSize}
        onDragStart={startMobileResize}
        onDrag={(height) => { mobileDragHeight = height; panelVisible = true; }}
        onSnap={snapMobilePanel}
      />

      <div class="navigator-positioner">
        <SlideshowNavigator
          slideshow={activeSlideshow}
          index={activeIndex}
          {panelVisible}
          isDarkMode={isDarkMode ?? false}
          {creditsOpen}
          backHref={isSubslideshowActive ? mainBreadcrumbHref : undefined}
          backTitle={rootSlideshow.title}
          onNavigate={scrollActivePanelToChapter}
          onLayers={toggleLayers}
          onChapters={toggleToc}
          onTheme={toggleTheme}
          onTogglePanel={togglePanel}
          onCredits={() => {
            const wasOpen = creditsOpen;
            closePanelOverlays();
            if (!wasOpen) activePanelOverlay = "credits";
          }}
          onMenuOpen={closePanelOverlays}
        />
      </div>

      <div class="panel-overlays" class:panel-overlays--at-navigator={!panelVisible}>
        {#if panelOverlayOpen}
          <button
            type="button"
            class="pointer-events-auto absolute inset-x-0 top-0 z-20 cursor-default rounded-t-[24px] bg-transparent p-0 focus:outline-none"
            style={`bottom: ${PANEL_NAVIGATOR_SPACE};`}
            aria-label={t("closePanelOverlay")}
            tabindex="-1"
            onclick={closePanelOverlays}
          ></button>
        {/if}

        <SlideshowToc
          open={tocOpen}
          {project}
          slideshow={activeSlideshow}
          {rootSlideshow}
          currentSlug={activeChapter?.slug}
          top="var(--reading-overlay-top, 8px)"
          bottomMargin={PANEL_NAVIGATOR_SPACE}
          onClose={closeToc}
          onSelectLocalChapter={scrollActivePanelToChapter}
        />
        {#if layersOpen}
          <SlideshowLayers
            {thumbnails}
            chapter={activeChapter}
            {hiddenWarpedMapUrls}
            {highlightedWarpedMapUrl}
            highlightEnabled={LAYER_HIGHLIGHT_ENABLED}
            top="var(--reading-overlay-top, 8px)"
            bottomMargin={PANEL_NAVIGATOR_SPACE}
            onClose={closePanelOverlays}
            onToggleVisibility={toggleWarpedMapVisibility}
            onZoomToBounds={zoomToWarpedMapBounds}
            onHighlight={highlightWarpedMap}
          />
        {/if}
        {#if creditsOpen}
          <PanelOverlay title={creditsTitle} top="var(--reading-overlay-top, 8px)" bottomMargin={PANEL_NAVIGATOR_SPACE} closeLabel={t("closeCredits")} onClose={closePanelOverlays}>
            {#if SharedCredits}<SharedCredits hideTitle />{/if}
            {#if CreditsComponent && activeSlideshow.credits !== project.credits}
              {#if SharedCredits}<h3 class="mt-6 mb-3 text-[24px]">{activeSlideshow.creditsTitle ?? activeSlideshow.title}</h3>{/if}
              <CreditsComponent hideTitle />
            {/if}
            {#if !SharedCredits && !CreditsComponent}
              <p class="text-[18px] leading-snug">{activeSlideshow.title}</p>
              <p class="mt-3 text-[16px] leading-snug">{t("noCredits")}</p>
            {/if}
          </PanelOverlay>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .reading-panel {
    position: absolute;
    inset: calc(-1 * var(--panel-outset));
    pointer-events: auto;
    padding-block: 12px;
  }
  .reading-panel--hidden {
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
  }

  .navigator-positioner,
  .panel-overlays {
    position: absolute;
    right: 0;
    bottom: 0;
    width: 100%;
    transition: right 500ms ease-in-out, width 500ms ease-in-out;
  }
  .navigator-positioner {
    right: var(--navigator-offset, 0px);
    width: var(--navigator-width, 100%);
    height: var(--navigator-height);
  }
  .panel-overlays { top: 0; }
  .panel-overlays--at-navigator {
    right: var(--navigator-offset, 0px);
    width: var(--navigator-width, 100%);
    --panel-overlay-clearance: calc(var(--navigator-height) + 6px);
  }

  .story-title,
  .story-panel {
    opacity: 1;
    transform: translate(0, 0);
    transition-duration: 500ms;
    transition-property: opacity, transform, right, bottom, width, height;
    transition-timing-function: ease-in-out;
  }

  .story-title--hidden {
    opacity: 0;
    transform: translateX(calc(-100% - 1.25rem));
  }

  .story-panel--hidden {
    opacity: 0;
    transform: translateY(calc(100% + 1.25rem));
  }

  @media (max-width: 767px) {
    .story-panel {
      --panel-inset: 12px;
      transition-duration: 550ms;
      transition-timing-function: cubic-bezier(.22, 1.3, .36, 1);
      --reading-overlay-top: var(--panel-handle-height);
      height: var(--mobile-panel-drag-height, var(--mobile-panel-rest-height, calc((100dvh - 2 * var(--panel-inset)) / 2)));
    }
    .story-panel--expanded {
      --mobile-panel-rest-height: calc(100dvh - 2 * var(--panel-inset));
    }
    .story-panel--dragging { transition: none; }
    .reading-panel {
      padding-top: var(--panel-handle-height);
      transform: translateY(0);
      transition: transform 550ms cubic-bezier(.22, 1.3, .36, 1), opacity 180ms ease, visibility 0s;
    }
    .reading-panel--hidden {
      transform: translateY(calc(100% - var(--navigator-height)));
      transition-delay: 0s, 0s, 550ms;
    }
    .story-panel--dragging .reading-panel { transition: none; }
  }

  @media (min-width: 640px) and (max-width: 767px) {
    .story-panel { --panel-inset: 16px; }
  }

  @media (min-width: 768px) {
    .story-panel { --navigator-width: 480px; }
    .story-panel--hidden {
      transform: translateX(calc(100% + 1.25rem));
    }
  }

  @media (min-width: 1536px) {
    .story-panel {
      --navigator-offset: calc(100% + 24px);
      --panel-overlay-clearance: 8px;
      --panel-scroll-clearance: 16px;
    }
    .panel-overlays {
      right: var(--navigator-offset);
      width: var(--navigator-width);
      --panel-overlay-clearance: calc(var(--navigator-height) + 6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .story-title,
    .story-panel,
    .reading-panel,
    .navigator-positioner,
    .panel-overlays {
      transition: none;
    }
  }
</style>
