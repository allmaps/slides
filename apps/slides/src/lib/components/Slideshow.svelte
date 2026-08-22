<script lang="ts">
  import { onMount, setContext, tick } from "svelte";

  import Map from "$lib/components/Map.svelte";
  import { getGeoJsonLayers } from "$lib/shared/geojson";
  import { getSlideshowRouteHref } from "$lib/shared/projects";
  import { DEFAULT_DURATION } from "$lib/shared/settings";
  import type {
    MapChapter,
    Project,
    Slideshow,
    SubslideshowReference,
  } from "$lib/shared/types";
  import { getValueAsArray } from "$lib/shared/utils";

  type Props = {
    project: Project;
    slideshow: Slideshow;
  };

  let { project, slideshow }: Props = $props();

  setContext("projectFolder", project.folder);

  const chapters = $derived(slideshow.chapters);
  const sources = $derived(slideshow.sources);

  let index: number = $state(0);
  let loaded: boolean = $state(false);
  let scrollContainer: HTMLDivElement | undefined = $state();
  let innerWidth: number = $state(0);
  let offsetHeight: number = $state(0);
  let clientWidth: number = $state(0);
  let visibleElements: string[] = $state(new Array());
  let isDarkMode: boolean | undefined = $state(undefined);

  const layers = $derived(Object.entries(sources).flatMap(([sourceId, source]) =>
    source.type === "geojson" ? getGeoJsonLayers(sourceId, "visible") : [],
  ));

  const padding = $derived({
    top: 25,
    bottom: 25,
    left: 25,
    right: 25,
  });

  const currentChapter = $derived(chapters[index]);
  const currentSlug = $derived(currentChapter?.slug);
  const firstChapter = $derived(chapters[0]);
  const slideshowKey = $derived(`${project.slug}:${slideshow.id}`);
  const observerKey = $derived(
    `${slideshow.id}:${chapters.map((chapter) => chapter.slug).join("\0")}`,
  );

  const getSubslideshowId = (reference: SubslideshowReference) =>
    typeof reference === "string" ? reference : reference.id;

  const getSubslideshowTitle = (
    reference: SubslideshowReference,
    slideshow: Slideshow,
  ) =>
    typeof reference === "string"
      ? slideshow.title
      : (reference.title ?? slideshow.title);

  const getSubslideshowHref = (slideshow: Slideshow) =>
    getSlideshowRouteHref(project, slideshow);

  const getChapterSubslideshows = (chapter: MapChapter) =>
    chapter.subslideshows
      ? getValueAsArray(chapter.subslideshows)
          .map((reference) => {
            const id = getSubslideshowId(reference);
            const subslideshow = project.slideshows.find(
              (candidate) => candidate.id === id,
            );

            if (!subslideshow?.slug) return undefined;

            return {
              id,
              href: getSubslideshowHref(subslideshow),
              title: getSubslideshowTitle(reference, subslideshow),
            };
          })
          .filter((reference) => reference !== undefined)
      : [];

  const getCurrentHash = () => {
    const hash = window.location.hash.slice(1);

    try {
      return decodeURIComponent(hash);
    } catch {
      return hash;
    }
  };

  const getSectionBySlug = (slug: string) =>
    Array.from(scrollContainer?.querySelectorAll<HTMLElement>("section") ?? [])
      .find((section) => section.dataset.id === slug);

  const waitForNextFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const scrollIntoView = (
    slug: string,
    behavior: ScrollBehavior = "smooth",
  ) => {
    const elem = getSectionBySlug(slug);
    elem?.scrollIntoView({ behavior, block: "start" });
  };

  const replaceHash = (hash: string) => {
    const encodedHash = encodeURIComponent(hash);
    const nextUrl = `${window.location.pathname}${window.location.search}#${encodedHash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  };

  $effect(() => {
    if (loaded && currentSlug && getCurrentHash() !== currentSlug) {
      replaceHash(currentSlug);
    }
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

  $effect(() => {
    observerKey;

    if (!scrollContainer) return;

    let observer: IntersectionObserver | undefined;
    let cancelled = false;

    index = 0;
    loaded = false;
    visibleElements = [];

    tick().then(async () => {
      if (cancelled || !scrollContainer) return;

      const initialHash = getCurrentHash();
      const initialHashIndex = chapters.findIndex(
        (chapter) => chapter.slug === initialHash,
      );

      if (initialHash && initialHashIndex >= 0) {
        index = initialHashIndex;
        scrollIntoView(initialHash, "auto");
      } else {
        scrollContainer.scrollTop = 0;
      }

      await waitForNextFrame();
      if (cancelled || !scrollContainer) return;

      const options = {
        root: scrollContainer,
        rootMargin: "-50%",
        threshold: 0,
      };
      const callback = (entries: IntersectionObserverEntry[]) => {
        const nextVisibleElements: string[] = [];

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elem = entry.target as HTMLElement;
            const currentIndex = Number(elem.dataset.index);
            const slug = elem.getAttribute("id");

            if (slug) {
              nextVisibleElements.push(slug);
            }
            index = currentIndex;
          }
        });

        visibleElements = nextVisibleElements;
      };

      observer = new IntersectionObserver(callback, options);
      const sections = scrollContainer.querySelectorAll("section");
      sections.forEach((element) => {
        observer?.observe(element);
      });
      loaded = true;
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  });
</script>

<svelte:window bind:innerWidth />

<svelte:head>
  <title>{slideshow.title}</title>
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
          {index}
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
    bind:clientWidth
    bind:offsetHeight
    bind:this={scrollContainer}
    class="row-start-2 min-h-0 bg-white/80 dark:bg-black/80 text-black dark:text-white pl-5 pr-5 overflow-auto md:row-start-1"
  >
    {#each chapters as chapter, index}
      {@const Component = chapter.Component}
      {@const isActive = currentSlug === chapter.slug}
      {@const subslideshows = getChapterSubslideshows(chapter)}
      <section
        class="pt-5 pb-5 min-h-[60%] {isActive
          ? 'opacity-100'
          : 'opacity-40'} transition-opacity"
        data-index={index}
        data-id={chapter.slug}
        id={chapter.slug}
      >
        <Component />
        {#if subslideshows.length}
          <div class="mt-6 flex flex-wrap gap-2">
            {#each subslideshows as subslideshow}
              <a
                class="inline-block border border-black/20 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                href={subslideshow.href}
              >
                {subslideshow.title}
              </a>
            {/each}
          </div>
        {/if}
        {#if index === 0}
          <div class="pt-10">
            <h2>Chapters</h2>
            {#each chapters as chapter, index}
              <button
                onclick={() => scrollIntoView(chapter.slug)}
                class="p-1 mr-5 font-medium cursor-pointer hover:bg-blue-300 inline-block whitespace-nowrap"
                >{index + 1}. {chapter.title}</button
              >
            {/each}
          </div>
        {/if}
      </section>
    {/each}
  </div>
</div>
