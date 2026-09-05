<script lang="ts">
  import { onMount } from "svelte";
  import {
    ChevronDown,
    ChevronRight,
    ListChevronsDownUp,
    ListChevronsUpDown,
  } from "@lucide/svelte";

  import PanelOverlay from "$lib/components/PanelOverlay.svelte";
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
    currentSlug?: string;
    top?: string;
    bottomMargin?: string;
    onClose?: () => void;
    onSelectLocalChapter?: (slug: string) => void | Promise<void>;
    class?: string;
  };

  let {
    project,
    slideshow,
    rootSlideshow,
    currentSlug,
    top,
    bottomMargin,
    onClose,
    onSelectLocalChapter,
    class: className = "",
  }: Props = $props();

  const tocSlideshow = $derived(rootSlideshow ?? slideshow);
  const tocChapters = $derived(tocSlideshow.chapters);

  let expandedTocEntryIds: string[] = $state([]);
  let expandedTocSubslideshowIds: string[] = $state([]);

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
    onClose?.();
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

  const selectLocalChapter = (slug: string) => {
    if (onSelectLocalChapter) {
      onSelectLocalChapter(slug);
    } else {
      closeToc();
    }
  };

  const selectSubslideshowHeading = (
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
      selectLocalChapter(firstSubchapter.slug);
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

  onMount(() => {
    expandedTocEntryIds = getDefaultExpandedTocEntryIds();
    expandedTocSubslideshowIds = getDefaultExpandedTocSubslideshowIds();
  });
</script>

<PanelOverlay title="Chapters" {top} {bottomMargin} class={className}>
  {#snippet actions()}
    {#if hasTocChevronColumn}
      <button
        type="button"
        class="toc-icon-button"
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
  {/snippet}

  <ol class="space-y-0.5 text-[18px] leading-[1.35] font-normal">
    {#each tocEntries as entry}
      {@const hasSubslideshows = entry.subslideshows.length > 0}
      {@const expanded = isTocEntryExpanded(entry.id)}
      {@const currentTocChapter = isCurrentTocChapter(entry.chapter)}
      <li>
        <div class="toc-row">
          {#if hasSubslideshows}
            <button
              type="button"
              class="toc-icon-button"
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
            <span class="toc-icon-spacer" aria-hidden="true"></span>
          {/if}

          {#if slideshow.id === tocSlideshow.id}
            <button
              type="button"
              class="toc-text-button {currentTocChapter
                ? 'toc-text-button-active'
                : ''}"
              aria-current={currentTocChapter ? "true" : undefined}
              onclick={() => selectLocalChapter(entry.chapter.slug)}
            >
              <span class="toc-text-label toc-text-label--truncate">
                {entry.chapter.title}
              </span>
            </button>
          {:else}
            <a
              class="toc-text-button {currentTocChapter
                ? 'toc-text-button-active'
                : ''}"
              aria-current={currentTocChapter ? "true" : undefined}
              href={getChapterHref(tocSlideshow, entry.chapter)}
              onclick={closeToc}
            >
              <span class="toc-text-label toc-text-label--truncate">
                {entry.chapter.title}
              </span>
            </a>
          {/if}
        </div>

        {#if hasSubslideshows && expanded}
          <div class="toc-children">
            {#if entry.subslideshows.length === 1}
              {@const subslideshow = entry.subslideshows[0]}
              {#if subslideshow.slideshow}
                {@const subslideshowData = subslideshow.slideshow}

                <ol class="py-0.5">
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
                          class="toc-text-button toc-text-button--block {currentSubchapter
                            ? 'toc-text-button-active'
                            : ''}"
                          aria-current={currentSubchapter ? "true" : undefined}
                          onclick={() => selectLocalChapter(subchapter.slug)}
                        >
                          <span class="toc-text-label">{subchapter.title}</span>
                        </button>
                      {:else}
                        <a
                          class="toc-text-button toc-text-button--block {currentSubchapter
                            ? 'toc-text-button-active'
                            : ''}"
                          aria-current={currentSubchapter ? "true" : undefined}
                          href={subchapterHref}
                          onclick={closeToc}
                        >
                          <span class="toc-text-label">{subchapter.title}</span>
                        </a>
                      {/if}
                    </li>
                  {/each}
                </ol>
              {/if}
            {:else}
              <ol class="py-0.5">
                {#each entry.subslideshows as subslideshow}
                  {#if subslideshow.slideshow}
                    {@const subslideshowData = subslideshow.slideshow}
                    {@const subslideshowEntryId = getTocSubslideshowEntryId(
                      entry.id,
                      subslideshow.id,
                    )}
                    {@const currentSubslideshow =
                      subslideshowData.id === slideshow.id}
                    {@const subslideshowExpanded =
                      isTocSubslideshowExpanded(subslideshowEntryId)}
                    <li>
                      <div class="toc-row">
                        <button
                          type="button"
                          class="toc-icon-button"
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
                          class="toc-text-button {currentSubslideshow
                            ? 'toc-text-button-active'
                            : ''}"
                          href={subslideshow.href}
                          onclick={(event) =>
                            selectSubslideshowHeading(event, subslideshowData)}
                        >
                          <span class="toc-text-label toc-text-label--truncate">
                            {subslideshow.title}
                          </span>
                        </a>
                      </div>

                      {#if subslideshowExpanded}
                        <ol class="toc-children py-0.5">
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
                                  class="toc-text-button toc-text-button--block {currentSubchapter
                                    ? 'toc-text-button-active'
                                    : ''}"
                                  aria-current={currentSubchapter
                                    ? "true"
                                    : undefined}
                                  onclick={() =>
                                    selectLocalChapter(subchapter.slug)}
                                >
                                  <span class="toc-text-label">
                                    {subchapter.title}
                                  </span>
                                </button>
                              {:else}
                                <a
                                  class="toc-text-button toc-text-button--block {currentSubchapter
                                    ? 'toc-text-button-active'
                                    : ''}"
                                  aria-current={currentSubchapter
                                    ? "true"
                                    : undefined}
                                  href={subchapterHref}
                                  onclick={closeToc}
                                >
                                  <span class="toc-text-label">
                                    {subchapter.title}
                                  </span>
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
</PanelOverlay>

<style>
  .toc-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .toc-icon-button {
    display: inline-flex;
    height: 1.5rem;
    width: 1.5rem;
    flex-shrink: 0;
    cursor: pointer;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    color: var(--app-overlay-icon);
    transition: background-color 150ms ease;
  }

  .toc-icon-button:hover {
    background: var(--app-overlay-selected-bg);
  }

  .toc-icon-spacer {
    display: inline-flex;
    height: 1.5rem;
    width: 1.5rem;
    flex-shrink: 0;
  }

  .toc-text-button {
    min-width: 0;
    flex: 1 1 0%;
    cursor: pointer;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    text-align: left;
    font-weight: 400;
    line-height: 1.35;
    text-decoration-color: currentColor;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.08em;
    transition: background-color 150ms ease;
  }

  .toc-text-button:hover {
    background: var(--app-overlay-selected-bg);
  }

  .toc-text-button-active {
    text-decoration-line: underline;
  }

  .toc-text-button--block {
    display: block;
    width: 100%;
  }

  .toc-text-label {
    display: block;
    transform: translateY(0.07em);
  }

  .toc-text-label--truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .toc-children {
    margin-left: 1.5rem;
  }
</style>
