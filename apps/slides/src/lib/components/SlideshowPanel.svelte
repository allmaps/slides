<script lang="ts">
  import { tick } from "svelte";
  import { fade } from "svelte/transition";
  import {
    ArrowRight,
    ChevronDown,
    ChevronRight,
    ListChevronsDownUp,
    ListChevronsUpDown,
  } from "@lucide/svelte";

  import { getSlideshowRouteHref } from "$lib/shared/projects";
  import type {
    MapChapter,
    Project,
    Slideshow,
    SubslideshowReference,
  } from "$lib/shared/types";

  type Props = {
    project: Project;
    slideshow: Slideshow;
    rootSlideshow?: Slideshow;
    active?: boolean;
    tocOpen?: boolean;
    scrollToTopSignal?: number;
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
    scrollToTopSignal = 0,
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
  let expandedTocSubslideshowIds: string[] = $state([]);
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
      ? chapter.subslideshows
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
    tocChapters.map((chapter) => ({
      id: `${tocSlideshow.id}:${chapter.slug}`,
      chapter,
      subslideshows: getChapterSubslideshows(chapter).map((subslideshow) => ({
        ...subslideshow,
        slideshow: project.slideshows.find(
          (candidate) => candidate.id === subslideshow.id,
        ),
      })),
    })),
  );
  const hasTocChevronColumn = $derived(
    tocEntries.some((entry) => entry.subslideshows.length > 0),
  );
  const expandableTocEntryIds = $derived(
    tocEntries
      .filter((entry) => entry.subslideshows.length > 0)
      .map((entry) => entry.id),
  );

  const getActiveTocEntry = () => {
    if (slideshow.id === tocSlideshow.id) {
      return tocEntries.find(
        (entry) =>
          entry.chapter.slug === currentSlug &&
          entry.subslideshows.length > 0,
      );
    }

    const matchingEntries = tocEntries.filter((entry) =>
      entry.subslideshows.some(
        (subslideshow) => subslideshow.id === slideshow.id,
      ),
    );

    return (
      matchingEntries.find((entry) => entry.subslideshows.length === 1) ??
      matchingEntries[0]
    );
  };

  const getDefaultExpandedTocEntryIds = () => {
    const activeEntry = getActiveTocEntry();

    return activeEntry ? [activeEntry.id] : [];
  };

  const getTocSubslideshowEntryId = (
    tocEntryId: string,
    subslideshowId: string,
  ) => `${tocEntryId}\0${subslideshowId}`;
  const expandableTocSubslideshowEntryIds = $derived(
    tocEntries.flatMap((entry) =>
      entry.subslideshows.length > 1
        ? entry.subslideshows.map((subslideshow) =>
            getTocSubslideshowEntryId(entry.id, subslideshow.id),
          )
        : [],
    ),
  );
  const allTocEntriesExpanded = $derived(
    expandableTocEntryIds.length > 0 &&
      expandableTocEntryIds.every((entryId) =>
        expandedTocEntryIds.includes(entryId),
      ) &&
      expandableTocSubslideshowEntryIds.every((entryId) =>
        expandedTocSubslideshowIds.includes(entryId),
      ),
  );

  const getDefaultExpandedTocSubslideshowIds = () =>
    slideshow.id === tocSlideshow.id
      ? []
      : (() => {
          const activeEntry = getActiveTocEntry();

          if (!activeEntry || activeEntry.subslideshows.length <= 1) return [];

          return activeEntry.subslideshows
            .filter((subslideshow) => subslideshow.id === slideshow.id)
            .map((subslideshow) =>
              getTocSubslideshowEntryId(activeEntry.id, subslideshow.id),
            );
        })();

  const closeToc = () => {
    onTocClose?.();
  };

  const isTocEntryExpanded = (entryId: string) =>
    expandedTocEntryIds.includes(entryId);

  const toggleTocEntry = (entryId: string) => {
    if (isTocEntryExpanded(entryId)) {
      expandedTocEntryIds = expandedTocEntryIds.filter((id) => id !== entryId);
      expandedTocSubslideshowIds = expandedTocSubslideshowIds.filter(
        (id) => !id.startsWith(`${entryId}\0`),
      );
    } else {
      expandedTocEntryIds = [...expandedTocEntryIds, entryId];
    }
  };

  const isTocSubslideshowExpanded = (entryId: string) =>
    expandedTocSubslideshowIds.includes(entryId);

  const toggleTocSubslideshowEntry = (entryId: string) => {
    expandedTocSubslideshowIds = isTocSubslideshowExpanded(entryId)
      ? expandedTocSubslideshowIds.filter((id) => id !== entryId)
      : [...expandedTocSubslideshowIds, entryId];
  };

  const toggleAllTocEntries = () => {
    if (allTocEntriesExpanded) {
      expandedTocEntryIds = [];
      expandedTocSubslideshowIds = [];
    } else {
      expandedTocEntryIds = expandableTocEntryIds;
      expandedTocSubslideshowIds = expandableTocSubslideshowEntryIds;
    }
  };

  const selectLocalChapter = async (slug: string) => {
    closeToc();
    await tick();
    scrollIntoView(slug);
  };

  const selectSubslideshowHeading = async (
    event: MouseEvent,
    subslideshow: Slideshow,
  ) => {
    if (subslideshow.id !== slideshow.id) {
      closeToc();
      return;
    }

    event.preventDefault();

    const firstSubchapter = subslideshow.chapters[0];
    if (firstSubchapter) {
      await selectLocalChapter(firstSubchapter.slug);
    } else {
      closeToc();
    }
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

    if (!elem || !scrollContainer) return;

    const elemRect = elem.getBoundingClientRect();
    const scrollContainerRect = scrollContainer.getBoundingClientRect();
    const top = elemRect.top - scrollContainerRect.top + scrollContainer.scrollTop;
    scrollContainer.scrollTo({ top, behavior });
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
      expandedTocSubslideshowIds = getDefaultExpandedTocSubslideshowIds();
    }

    wasTocOpen = tocOpen;
  });

  $effect(() => {
    scrollToTopSignal;

    if (!scrollToTopSignal || !active || !scrollContainer) return;

    scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
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
  <div
    bind:this={scrollContainer}
    class="h-full min-h-0 overflow-x-hidden overflow-y-auto px-5"
  >
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
                onclick={closeToc}
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
      class="absolute inset-0 z-20 overflow-x-hidden overflow-y-auto bg-white/95 px-5 py-4 shadow-2xl backdrop-blur dark:bg-black/95"
      transition:fade={{ duration: 150 }}
    >
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="text-base font-semibold">Contents</h2>

        {#if hasTocChevronColumn}
          <button
            type="button"
            class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
            aria-label={allTocEntriesExpanded ? "Collapse all" : "Expand all"}
            title={allTocEntriesExpanded ? "Collapse all" : "Expand all"}
            onclick={toggleAllTocEntries}
          >
            {#if allTocEntriesExpanded}
              <ListChevronsDownUp size={16} aria-hidden="true" />
            {:else}
              <ListChevronsUpDown size={16} aria-hidden="true" />
            {/if}
          </button>
        {/if}
      </div>

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
                  class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
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
              {:else if hasTocChevronColumn}
                <span
                  class="inline-flex h-8 w-8 shrink-0"
                  aria-hidden="true"
                ></span>
              {/if}

              {#if slideshow.id === tocSlideshow.id}
                <button
                  type="button"
                  class="min-w-0 flex-1 cursor-pointer py-2 text-left text-sm font-medium {!hasSubslideshows &&
                  !hasTocChevronColumn
                    ? 'px-2'
                    : ''} {currentTocChapter
                    ? ''
                    : 'hover:underline'}"
                  aria-current={currentTocChapter ? "true" : undefined}
                  onclick={() => selectLocalChapter(entry.chapter.slug)}
                >
                  <span class="block truncate">{entry.chapter.title}</span>
                </button>
              {:else}
                <a
                  class="min-w-0 flex-1 cursor-pointer py-2 text-sm font-medium {!hasSubslideshows &&
                  !hasTocChevronColumn
                    ? 'px-2'
                    : ''} {currentTocChapter
                    ? ''
                    : 'hover:underline'}"
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
                {#if entry.subslideshows.length === 1}
                  {@const subslideshow = entry.subslideshows[0]}
                  {#if subslideshow.slideshow}
                    {@const subslideshowData = subslideshow.slideshow}

                    <ol class="py-1">
                      {#each subslideshowData.chapters as subchapter}
                        {@const subchapterHref = getChapterHref(
                          subslideshowData,
                          subchapter,
                        )}
                        {@const currentSubchapter = isCurrentSubchapter(
                          subslideshowData,
                          subchapter,
                        )}
                        <li>
                          {#if subslideshowData.id === slideshow.id}
                            <button
                              type="button"
                              class="block w-full cursor-pointer px-3 py-2 text-left text-sm {currentSubchapter
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'hover:bg-black/5 dark:hover:bg-white/10'}"
                              aria-current={currentSubchapter ? "true" : undefined}
                              onclick={() => selectLocalChapter(subchapter.slug)}
                            >
                              <span>{subchapter.title}</span>
                            </button>
                          {:else}
                            <a
                              class="block cursor-pointer px-3 py-2 text-sm {currentSubchapter
                                ? 'bg-black text-white dark:bg-white dark:text-black'
                                : 'hover:bg-black/5 dark:hover:bg-white/10'}"
                              aria-current={currentSubchapter ? "true" : undefined}
                              href={subchapterHref}
                              onclick={closeToc}
                            >
                              <span>{subchapter.title}</span>
                            </a>
                          {/if}
                        </li>
                      {/each}
                    </ol>
                  {/if}
                {:else}
                  <ol class="py-1">
                    {#each entry.subslideshows as subslideshow}
                      {#if subslideshow.slideshow}
                        {@const subslideshowData = subslideshow.slideshow}
                        {@const subslideshowEntryId = getTocSubslideshowEntryId(
                          entry.id,
                          subslideshow.id,
                        )}
                        {@const subslideshowExpanded =
                          isTocSubslideshowExpanded(subslideshowEntryId)}
                        <li>
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              class="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label={subslideshowExpanded
                                ? `Collapse ${subslideshow.title}`
                                : `Expand ${subslideshow.title}`}
                              aria-expanded={subslideshowExpanded}
                              onclick={() =>
                                toggleTocSubslideshowEntry(subslideshowEntryId)}
                            >
                              {#if subslideshowExpanded}
                                <ChevronDown size={16} aria-hidden="true" />
                              {:else}
                                <ChevronRight size={16} aria-hidden="true" />
                              {/if}
                            </button>

                            <a
                              class="min-w-0 flex-1 cursor-pointer py-2 text-sm font-medium hover:underline"
                              href={subslideshow.href}
                              onclick={(event) =>
                                selectSubslideshowHeading(
                                  event,
                                  subslideshowData,
                                )}
                            >
                              <span class="block truncate">
                                {subslideshow.title}
                              </span>
                            </a>
                          </div>

                          {#if subslideshowExpanded}
                            <ol class="ml-8 border-l border-black/10 py-1 pl-3 dark:border-white/15">
                              {#each subslideshowData.chapters as subchapter}
                                {@const subchapterHref = getChapterHref(
                                  subslideshowData,
                                  subchapter,
                                )}
                                {@const currentSubchapter = isCurrentSubchapter(
                                  subslideshowData,
                                  subchapter,
                                )}
                                <li>
                                  {#if subslideshowData.id === slideshow.id}
                                    <button
                                      type="button"
                                      class="block w-full cursor-pointer px-3 py-2 text-left text-sm {currentSubchapter
                                        ? 'bg-black text-white dark:bg-white dark:text-black'
                                        : 'hover:bg-black/5 dark:hover:bg-white/10'}"
                                      aria-current={currentSubchapter
                                        ? "true"
                                        : undefined}
                                      onclick={() =>
                                        selectLocalChapter(subchapter.slug)}
                                    >
                                      <span>{subchapter.title}</span>
                                    </button>
                                  {:else}
                                    <a
                                      class="block cursor-pointer px-3 py-2 text-sm {currentSubchapter
                                        ? 'bg-black text-white dark:bg-white dark:text-black'
                                        : 'hover:bg-black/5 dark:hover:bg-white/10'}"
                                      aria-current={currentSubchapter
                                        ? "true"
                                        : undefined}
                                      href={subchapterHref}
                                      onclick={closeToc}
                                    >
                                      <span>{subchapter.title}</span>
                                    </a>
                                  {/if}
                                </li>
                              {/each}
                            </ol>
                          {/if}
                        </li>
                      {/if}
                    {/each}
                  </ol>
                {/if}
              </div>
            {/if}
          </li>
        {/each}
      </ol>
    </div>
  {/if}
</div>
