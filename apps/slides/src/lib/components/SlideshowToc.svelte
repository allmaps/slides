<script lang="ts">
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import {
    ChevronDown,
    ChevronRight,
    ListChevronsDownUp,
    ListChevronsUpDown,
  } from "@lucide/svelte";

  import PanelOverlay from "$lib/components/PanelOverlay.svelte";
  import {
    getChapterAnchorHref,
    getSlideshowRouteHref,
  } from "$lib/shared/project";
  import type {
    MapChapter,
    Project,
    Slideshow,
    SubslideshowReference,
  } from "$lib/shared/types";

  type Props = {
    open?: boolean;
    project: Project;
    slideshow: Slideshow;
    rootSlideshow?: Slideshow;
    currentSlug?: string;
    top?: string;
    bottomMargin?: string;
    tab?: "toc" | "layers";
    onClose?: () => void;
    onSelectLocalChapter?: (slug: string) => void | Promise<void>;
    class?: string;
  };

  let {
    open = true,
    project,
    slideshow,
    rootSlideshow,
    currentSlug,
    top,
    bottomMargin,
    tab,
    onClose,
    onSelectLocalChapter,
    class: className = "",
  }: Props = $props();

  const alphabeticIndex = (index: number): string => {
    let label = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(97 + (n - 1) % 26) + label;
    return label;
  };
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
    getSlideshowRouteHref(slideshow);

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
    getChapterAnchorHref(slideshow, chapter);

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

  const selectChapter = (event: MouseEvent, target: Slideshow, chapter: MapChapter) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (target.id === slideshow.id && onSelectLocalChapter) {
      event.preventDefault();
      selectLocalChapter(chapter.slug);
    } else {
      closeToc();
    }
  };

  const selectSubslideshowHeading = (
    event: MouseEvent,
    subslideshow: Slideshow,
  ) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (subslideshow.id !== slideshow.id || !onSelectLocalChapter) {
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

  $effect(() => {
    if (!open) return;
    expandedTocEntryIds = getDefaultExpandedTocEntryIds();
    expandedTocSubslideshowIds = getDefaultExpandedTocSubslideshowIds();
  });
</script>

<PanelOverlay
  {open}
  title={t("chapters")}
  {top}
  {bottomMargin}
  {tab}
  closeLabel={t("closeChapters")}
  onClose={onClose}
  class={className}
>
  {#snippet actions()}
    {#if hasTocChevronColumn}
      <button
        type="button"
        class="toc-icon-button"
        aria-label={t(allTocEntriesExpanded ? "collapseAll" : "expandAll")}
        title={t(allTocEntriesExpanded ? "collapseAll" : "expandAll")}
        onclick={toggleAllTocEntries}
      >
        {#if allTocEntriesExpanded}
          <ListChevronsDownUp size={22} aria-hidden="true" />
        {:else}
          <ListChevronsUpDown size={22} aria-hidden="true" />
        {/if}
      </button>
    {/if}
  {/snippet}

  <nav aria-label={t("chapters")}>
    <ol class="space-y-0.5 text-[18px] leading-[1.35] font-normal">
      {#each tocEntries as entry, chapterIndex}
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
                  ? t("collapseTitle", { title: entry.chapter.title })
                  : t("expandTitle", { title: entry.chapter.title })}
                aria-expanded={expanded}
                onclick={() => toggleTocEntry(entry.id)}
              >
                {#if expanded}
                  <ChevronDown size={22} aria-hidden="true" />
                {:else}
                  <ChevronRight size={22} aria-hidden="true" />
                {/if}
              </button>
            {:else if hasTocChevronColumn}
              <span class="toc-icon-spacer" aria-hidden="true"></span>
            {/if}

            <a
              class="toc-text-button {currentTocChapter
                ? 'toc-text-button-active'
                : ''}"
              aria-current={currentTocChapter ? "true" : undefined}
              href={getChapterHref(tocSlideshow, entry.chapter)}
              onclick={(event) => selectChapter(event, tocSlideshow, entry.chapter)}
            >
              <span class="toc-text-label toc-text-label--truncate">
                <span class="toc-number">{chapterIndex + 1}.</span><span>{entry.chapter.title}</span>
              </span>
            </a>
          </div>

          {#if hasSubslideshows}
            <div class="toc-children" hidden={!expanded}>
              {#if entry.subslideshows.length === 1}
                {@const subslideshow = entry.subslideshows[0]}
                {#if subslideshow.slideshow}
                  {@const subslideshowData = subslideshow.slideshow}

                  <ol class="py-0.5">
                    {#each subslideshowData.chapters as subchapter, subchapterIndex}
                      {@const subchapterHref = getChapterHref(
                        subslideshowData,
                        subchapter,
                      )}
                      {@const currentSubchapter = isCurrentSubchapter(
                        subslideshowData,
                        subchapter,
                      )}
                      <li>
                        <a
                          class="toc-text-button toc-text-button--block {currentSubchapter
                            ? 'toc-text-button-active'
                            : ''}"
                          aria-current={currentSubchapter ? "true" : undefined}
                          href={subchapterHref}
                          onclick={(event) => selectChapter(event, subslideshowData, subchapter)}
                        >
                          <span class="toc-text-label"><span class="toc-number">{alphabeticIndex(subchapterIndex)}.</span><span>{subchapter.title}</span></span>
                        </a>
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
                              ? t("collapseTitle", { title: subslideshow.title })
                              : t("expandTitle", { title: subslideshow.title })}
                            aria-expanded={subslideshowExpanded}
                            onclick={() =>
                              toggleTocSubslideshowEntry(subslideshowEntryId)}
                          >
                            {#if subslideshowExpanded}
                              <ChevronDown size={22} aria-hidden="true" />
                            {:else}
                              <ChevronRight size={22} aria-hidden="true" />
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

                        <ol class="toc-children py-0.5" hidden={!subslideshowExpanded}>
                          {#each subslideshowData.chapters as subchapter, subchapterIndex}
                            {@const subchapterHref = getChapterHref(
                              subslideshowData,
                              subchapter,
                            )}
                            {@const currentSubchapter = isCurrentSubchapter(
                              subslideshowData,
                              subchapter,
                            )}
                            <li>
                              <a
                                class="toc-text-button toc-text-button--block {currentSubchapter
                                  ? 'toc-text-button-active'
                                  : ''}"
                                aria-current={currentSubchapter
                                  ? "true"
                                  : undefined}
                                href={subchapterHref}
                                onclick={(event) => selectChapter(event, subslideshowData, subchapter)}
                              >
                                <span class="toc-text-label">
                                  <span class="toc-number">{alphabeticIndex(subchapterIndex)}.</span><span>{subchapter.title}</span>
                                </span>
                              </a>
                            </li>
                          {/each}
                        </ol>
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
  </nav>
</PanelOverlay>

<style>
  .toc-row {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .toc-icon-button {
    display: inline-flex;
    height: 2.5rem;
    width: 2.5rem;
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
    height: 2.5rem;
    width: 2.5rem;
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
    display: flex;
    gap: 0.4rem;
    transform: translateY(0.07em);
  }

  .toc-text-label--truncate {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: normal;
  }

  .toc-children {
    margin-left: 2.5rem;
    padding-left: 0.75rem;
    border-left: 1px solid color-mix(in srgb, currentColor 16%, transparent);
  }
  .toc-number { flex: 0 0 1.4em; font-variant-numeric: tabular-nums; color: var(--app-overlay-icon); }
</style>
