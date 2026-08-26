<script lang="ts">
  import { tick } from "svelte";
  import { ArrowRight, ChevronDown, ChevronRight } from "@lucide/svelte";

  import { getSlideshowRouteHref } from "$lib/shared/projects";
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
    rootSlideshow?: Slideshow;
    active?: boolean;
    tocOpen?: boolean;
    onTocClose?: () => void;
    onIndexChange?: (index: number) => void;
    class?: string;
  };

  let {
    project,
    slideshow,
    rootSlideshow,
    active = true,
    tocOpen = false,
    onTocClose,
    onIndexChange,
    class: className = "",
  }: Props = $props();

  const chapters = $derived(slideshow.chapters);
  const tocSlideshow = $derived(rootSlideshow ?? slideshow);
  const tocChapters = $derived(tocSlideshow.chapters);
  const firstChapter = $derived(chapters[0]);

  let index: number = $state(0);
  let loaded: boolean = $state(false);
  let scrollContainer: HTMLDivElement | undefined = $state();
  let expandedTocEntryIds: string[] = $state([]);
  let wasTocOpen: boolean = $state(false);

  const currentChapter = $derived(chapters[index]);
  const currentSlug = $derived(currentChapter?.slug);
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

  const getChapterHref = (slideshow: Slideshow, chapter: MapChapter) =>
    `${getSubslideshowHref(slideshow)}#${encodeURIComponent(chapter.slug)}`;

  const tocEntries = $derived(
    tocChapters.map((chapter, index) => ({
      id: `${tocSlideshow.id}:${chapter.slug}`,
      chapter,
      index,
      subslideshows: getChapterSubslideshows(chapter).map((subslideshow) => ({
        ...subslideshow,
        slideshow: project.slideshows.find(
          (candidate) => candidate.id === subslideshow.id,
        ),
      })),
    })),
  );

  const getDefaultExpandedTocEntryIds = () =>
    slideshow.id === tocSlideshow.id
      ? []
      : tocEntries
          .filter((entry) => entry.subslideshows.length > 0)
          .map((entry) => entry.id);

  const closeToc = () => {
    onTocClose?.();
  };

  const isTocEntryExpanded = (entryId: string) =>
    expandedTocEntryIds.includes(entryId);

  const toggleTocEntry = (entryId: string) => {
    expandedTocEntryIds = isTocEntryExpanded(entryId)
      ? expandedTocEntryIds.filter((id) => id !== entryId)
      : [...expandedTocEntryIds, entryId];
  };

  const selectLocalChapter = async (slug: string) => {
    closeToc();
    await tick();
    scrollIntoView(slug);
  };

  const isCurrentTocChapter = (chapter: MapChapter) =>
    slideshow.id === tocSlideshow.id && currentSlug === chapter.slug;

  const isCurrentSubchapter = (
    subslideshow: Slideshow | undefined,
    chapter: MapChapter,
  ) => subslideshow?.id === slideshow.id && currentSlug === chapter.slug;

  const setIndex = (nextIndex: number) => {
    index = nextIndex;
    onIndexChange?.(nextIndex);
  };

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
    if (active && loaded && currentSlug && getCurrentHash() !== currentSlug) {
      replaceHash(currentSlug);
    }
  });

  $effect(() => {
    if (tocOpen && !wasTocOpen) {
      expandedTocEntryIds = getDefaultExpandedTocEntryIds();
    }

    wasTocOpen = tocOpen;
  });

  $effect(() => {
    observerKey;

    if (!scrollContainer) return;

    let observer: IntersectionObserver | undefined;
    let cancelled = false;

    setIndex(0);
    loaded = false;

    tick().then(async () => {
      if (cancelled || !scrollContainer) return;

      const initialHash = getCurrentHash();
      const initialHashIndex = chapters.findIndex(
        (chapter) => chapter.slug === initialHash,
      );

      if (initialHash && initialHashIndex >= 0) {
        setIndex(initialHashIndex);
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
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elem = entry.target as HTMLElement;
            setIndex(Number(elem.dataset.index));
          }
        });
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

<div
  class="relative h-full min-h-0 text-black dark:text-white {className}"
>
  <div bind:this={scrollContainer} class="h-full min-h-0 overflow-auto px-5">
    {#each chapters as chapter, index}
      {@const Component = chapter.Component}
      {@const isActive = currentSlug === chapter.slug}
      {@const subslideshows = getChapterSubslideshows(chapter)}
      <section
        class="py-5 min-h-[60%] {isActive
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
                class="inline-flex items-center gap-2 border border-black/20 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
                href={subslideshow.href}
              >
                <span>{subslideshow.title}</span>
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            {/each}
          </div>
        {/if}
      </section>
    {:else}
      <section class="py-5 min-h-[60%]">
        <h1>{slideshow.title}</h1>
        {#if firstChapter?.description}
          <p>{firstChapter.description}</p>
        {/if}
      </section>
    {/each}
  </div>

  {#if tocOpen}
    <div
      class="absolute inset-0 z-20 overflow-auto bg-white/95 px-5 py-4 shadow-2xl backdrop-blur dark:bg-black/95"
    >
      <h2 class="mb-4 text-base font-semibold">Contents</h2>

      <ol class="space-y-1">
        {#each tocEntries as entry}
          {@const hasSubslideshows = entry.subslideshows.length > 0}
          {@const expanded = isTocEntryExpanded(entry.id)}
          {@const currentTocChapter = isCurrentTocChapter(entry.chapter)}
          <li>
            <div
              class="flex items-center gap-2 {currentTocChapter
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : ''}"
            >
              {#if hasSubslideshows}
                <button
                  type="button"
                  class="inline-flex h-8 w-8 shrink-0 items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label={expanded
                    ? `Collapse ${entry.chapter.title}`
                    : `Expand ${entry.chapter.title}`}
                  aria-expanded={expanded}
                  onclick={() => toggleTocEntry(entry.id)}
                >
                  {#if expanded}
                    <ChevronDown size={16} aria-hidden="true" />
                  {:else}
                    <ChevronRight size={16} aria-hidden="true" />
                  {/if}
                </button>
              {:else}
                <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center text-xs opacity-60">
                  {entry.index + 1}
                </span>
              {/if}

              {#if slideshow.id === tocSlideshow.id}
                <button
                  type="button"
                  class="min-w-0 flex-1 py-2 text-left text-sm font-medium hover:underline"
                  aria-current={currentTocChapter ? "true" : undefined}
                  onclick={() => selectLocalChapter(entry.chapter.slug)}
                >
                  <span class="block truncate">{entry.chapter.title}</span>
                </button>
              {:else}
                <a
                  class="min-w-0 flex-1 py-2 text-sm font-medium hover:underline"
                  aria-current={currentTocChapter ? "true" : undefined}
                  href={getChapterHref(tocSlideshow, entry.chapter)}
                  onclick={closeToc}
                >
                  <span class="block truncate">{entry.chapter.title}</span>
                </a>
              {/if}
            </div>

            {#if hasSubslideshows && expanded}
              <div class="ml-8 border-l border-black/10 pl-3 dark:border-white/15">
                {#each entry.subslideshows as subslideshow}
                  {#if subslideshow.slideshow}
                    {#if entry.subslideshows.length > 1}
                      <a
                        class="mt-2 block text-xs font-semibold uppercase opacity-70 hover:underline"
                        href={subslideshow.href}
                        onclick={closeToc}
                      >
                        {subslideshow.title}
                      </a>
                    {/if}

                    <ol class="py-1">
                      {#each subslideshow.slideshow.chapters as subchapter, subchapterIndex}
                        {@const currentSubchapter = isCurrentSubchapter(
                          subslideshow.slideshow,
                          subchapter,
                        )}
                        <li>
                          {#if subslideshow.slideshow.id === slideshow.id}
                            <button
                              type="button"
                              class="flex w-full items-start gap-2 px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 {currentSubchapter
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : ''}"
                              aria-current={currentSubchapter ? "true" : undefined}
                              onclick={() => selectLocalChapter(subchapter.slug)}
                            >
                              <span class="w-6 shrink-0 text-xs opacity-60">
                                {subchapterIndex + 1}
                              </span>
                              <span>{subchapter.title}</span>
                            </button>
                          {:else}
                            <a
                              class="flex items-start gap-2 px-2 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 {currentSubchapter
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : ''}"
                              aria-current={currentSubchapter ? "true" : undefined}
                              href={getChapterHref(subslideshow.slideshow, subchapter)}
                              onclick={closeToc}
                            >
                              <span class="w-6 shrink-0 text-xs opacity-60">
                                {subchapterIndex + 1}
                              </span>
                              <span>{subchapter.title}</span>
                            </a>
                          {/if}
                        </li>
                      {/each}
                    </ol>
                  {/if}
                {/each}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</div>
