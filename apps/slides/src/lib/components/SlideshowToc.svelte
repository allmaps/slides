<script lang="ts">
  import { tick } from "svelte";
  import { getInterfaceText } from "$lib/shared/interface-context";
  import { emptyThumbnails, slidePreviewKey, type ThumbnailManifest } from "$lib/shared/thumbnails";
  import { withBaseUrl } from "$lib/shared/paths";
  const t = getInterfaceText();
  import {
    ChevronRight,
    ListChevronsDownUp,
    ListChevronsUpDown,
  } from "@lucide/svelte";

  import { getChapterNumber, getSubslideshowNumber } from "@allmaps/slides/model/project";
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
    thumbnails?: ThumbnailManifest;
    isDarkMode?: boolean;
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
    thumbnails = emptyThumbnails(),
    isDarkMode = false,
    top,
    bottomMargin,
    tab,
    onClose,
    onSelectLocalChapter,
    class: className = "",
  }: Props = $props();

  const tocSlideshow = $derived(rootSlideshow ?? slideshow);
  const tocChapters = $derived(tocSlideshow.chapters);

  let expandedTocEntryIds: string[] = $state([]);
  let expandedTocSubslideshowIds: string[] = $state([]);

  const previewId = $props.id();
  let previewTarget = $state<{ element: HTMLAnchorElement; key: string }>();
  let previewElement = $state<HTMLDivElement>();
  let previewTimer: ReturnType<typeof setTimeout> | undefined;
  let previewPointer: { x: number; y: number } | undefined;
  let previewPlacement: { popup: HTMLDivElement; left: boolean; above: boolean } | undefined;
  let previewAnimation: Animation | undefined;
  const previewThumbnail = $derived(open && previewTarget
    ? thumbnails.slides[previewTarget.key]?.[isDarkMode ? "dark" : "light"]
    : undefined);

  function keepPreview() {
    clearTimeout(previewTimer);
  }

  function hidePreview() {
    keepPreview();
    previewAnimation?.cancel();
    previewAnimation = undefined;
    previewPlacement = undefined;
    previewTarget = undefined;
    previewPointer = undefined;
  }

  function leavePreview() {
    keepPreview();
    previewTimer = setTimeout(hidePreview, 150);
  }

  function positionPreview(popup: HTMLDivElement, element: HTMLAnchorElement) {
    const row = previewPointer ? undefined : element.getBoundingClientRect();
    const point = previewPointer ?? { x: row!.right, y: row!.bottom };
    const previousBounds = popup.getBoundingClientRect();
    const { width, height } = previousBounds;
    const gap = 16;
    const margin = 12;
    let left = point.x + gap;
    let top = point.y + gap;
    const flipLeft = left + width > window.innerWidth - margin;
    const flipAbove = top + height > window.innerHeight - margin;
    if (flipLeft) left = point.x - width - gap;
    if (flipAbove) top = point.y - height - gap;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;

    if (previewPlacement?.popup === popup &&
        (previewPlacement.left !== flipLeft || previewPlacement.above !== flipAbove)) {
      previewAnimation?.cancel();
      // Animate only the corner offset; left/top keep tracking the cursor directly.
      // Start from the visible position so another flip can interrupt smoothly.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        previewAnimation = popup.animate([
          { transform: `translate(${previousBounds.left - left}px, ${previousBounds.top - top}px)` },
          { transform: "translate(0, 0)" },
        ], { duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
      }
    }
    previewPlacement = { popup, left: flipLeft, above: flipAbove };
  }

  // One preview shared by all chapter links, including nested slideshows.
  function chapterPreview(element: HTMLAnchorElement, key: string) {
    const show = () => {
      keepPreview();
      if (!open || !thumbnails.slides[key]) {
        hidePreview();
        return;
      }
      // Delay the first preview only; moving between chapters reuses it immediately.
      if (previewTarget) previewTarget = { element, key };
      else previewTimer = setTimeout(() => { previewTarget = { element, key }; }, 180);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      previewPointer = { x: event.clientX, y: event.clientY };
      if (previewTarget?.element === element && previewElement?.matches(":popover-open"))
        positionPreview(previewElement, element);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      move(event);
      show();
    };
    const focus = () => {
      if (!element.matches(":focus-visible")) return;
      previewPointer = undefined;
      show();
    };
    element.addEventListener("pointerenter", enter);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leavePreview);
    element.addEventListener("focus", focus);
    element.addEventListener("blur", leavePreview);
    element.addEventListener("click", hidePreview);
    return {
      update(nextKey: string) { key = nextKey; },
      destroy() {
        element.removeEventListener("pointerenter", enter);
        element.removeEventListener("pointermove", move);
        element.removeEventListener("pointerleave", leavePreview);
        element.removeEventListener("focus", focus);
        element.removeEventListener("blur", leavePreview);
        element.removeEventListener("click", hidePreview);
        if (previewTarget?.element === element) hidePreview();
      },
    };
  }

  $effect(() => {
    if (!open) hidePreview();
  });

  $effect(() => {
    const target = previewTarget;
    const popup = previewElement;
    if (!previewThumbnail || !target || !popup) return;
    let cancelled = false;
    tick().then(() => {
      if (cancelled) return;
      // The top layer escapes the card's overflow and animated transforms.
      popup.showPopover();
      positionPreview(popup, target.element);
      target.element.setAttribute("aria-describedby", previewId);
    });
    const keydown = (event: KeyboardEvent) => { if (event.key === "Escape") hidePreview(); };
    window.addEventListener("scroll", hidePreview, true);
    window.addEventListener("resize", hidePreview);
    window.addEventListener("keydown", keydown);
    return () => {
      cancelled = true;
      target.element.removeAttribute("aria-describedby");
      window.removeEventListener("scroll", hidePreview, true);
      window.removeEventListener("resize", hidePreview);
      window.removeEventListener("keydown", keydown);
    };
  });

  $effect(() => () => {
    keepPreview();
    previewAnimation?.cancel();
  });

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
  closeLabel={t("close")}
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
    <ol class="text-[18px] leading-[1.35] font-normal">
      {#each tocEntries as entry}
        {@const chapterNumber = getChapterNumber(tocSlideshow, entry.chapter.slug)}
        {@const hasSubslideshows = entry.subslideshows.length > 0}
        {@const expanded = isTocEntryExpanded(entry.id)}
        {@const currentTocChapter = isCurrentTocChapter(entry.chapter)}
        <li>
          <div class="toc-row">
            <a
              class="toc-text-button {currentTocChapter
                ? 'toc-text-button-active'
                : ''}"
              aria-current={currentTocChapter ? "true" : undefined}
              href={getChapterHref(tocSlideshow, entry.chapter)}
              use:chapterPreview={slidePreviewKey(tocSlideshow.id, entry.chapter.slug)}
              onclick={(event) => selectChapter(event, tocSlideshow, entry.chapter)}
            >
              <span class="toc-text-label toc-text-label--truncate">
                <span class="toc-number">{chapterNumber === undefined ? "" : `${chapterNumber}.`}</span><span class="toc-title">{entry.chapter.title}</span>
              </span>
            </a>
            {#if hasSubslideshows}
              <button
                type="button"
                class="toc-icon-button"
                aria-label={expanded
                  ? t("collapse")
                  : t("expand")}
                aria-expanded={expanded}
                onclick={() => toggleTocEntry(entry.id)}
              >
                <span class="toc-chevron" class:toc-chevron--expanded={expanded}>
                  <ChevronRight size={22} aria-hidden="true" />
                </span>
              </button>
            {:else if hasTocChevronColumn}
              <span class="toc-icon-spacer" aria-hidden="true"></span>
            {/if}
          </div>

          {#if hasSubslideshows}
            <div class="toc-disclosure" class:toc-disclosure--expanded={expanded} aria-hidden={!expanded} inert={!expanded}>
              <div class="toc-children">
                {#if entry.subslideshows.length === 1}
                  {@const subslideshow = entry.subslideshows[0]}
                  {#if subslideshow.slideshow}
                    {@const subslideshowData = subslideshow.slideshow}

                    <ol>
                      {#each subslideshowData.chapters as subchapter}
                        {@const sectionNumber = getChapterNumber(subslideshowData, subchapter.slug)}
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
                            use:chapterPreview={slidePreviewKey(subslideshowData.id, subchapter.slug)}
                            onclick={(event) => selectChapter(event, subslideshowData, subchapter)}
                          >
                            <span class="toc-text-label"><span class="toc-number">{sectionNumber === undefined ? "" : [chapterNumber, sectionNumber].filter(number => number !== undefined).join(".")}</span><span class="toc-title">{subchapter.title}</span></span>
                          </a>
                        </li>
                      {/each}
                    </ol>
                  {/if}
                {:else}
                  <ol>
                    {#each entry.subslideshows as subslideshow}
                      {@const slideshowNumber = getSubslideshowNumber(tocSlideshow, entry.chapter, subslideshow.id)}
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
                            <a
                              class="toc-text-button {currentSubslideshow
                                ? 'toc-text-button-active'
                                : ''}"
                              href={subslideshow.href}
                              use:chapterPreview={slidePreviewKey(subslideshowData.id, subslideshowData.chapters[0]?.slug ?? "")}
                              onclick={(event) =>
                                selectSubslideshowHeading(event, subslideshowData)}
                            >
                              <span class="toc-text-label toc-text-label--truncate">
                                <span class="toc-number">{slideshowNumber ?? ""}</span><span class="toc-title">{subslideshow.title}</span>
                              </span>
                            </a>
                            <button
                              type="button"
                              class="toc-icon-button"
                              aria-label={subslideshowExpanded
                                ? t("collapse")
                                : t("expand")}
                              aria-expanded={subslideshowExpanded}
                              onclick={() =>
                                toggleTocSubslideshowEntry(subslideshowEntryId)}
                            >
                              <span class="toc-chevron" class:toc-chevron--expanded={subslideshowExpanded}>
                                <ChevronRight size={22} aria-hidden="true" />
                              </span>
                            </button>
                          </div>

                          <div class="toc-disclosure" class:toc-disclosure--expanded={subslideshowExpanded} aria-hidden={!subslideshowExpanded} inert={!subslideshowExpanded}>
                            <div class="toc-children">
                              <ol>
                                {#each subslideshowData.chapters as subchapter}
                                  {@const sectionNumber = getChapterNumber(subslideshowData, subchapter.slug)}
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
                                      use:chapterPreview={slidePreviewKey(subslideshowData.id, subchapter.slug)}
                                      onclick={(event) => selectChapter(event, subslideshowData, subchapter)}
                                    >
                                      <span class="toc-text-label">
                                        <span class="toc-number">{sectionNumber === undefined ? "" : [slideshowNumber, sectionNumber].filter(number => number !== undefined).join(".")}</span><span class="toc-title">{subchapter.title}</span>
                                      </span>
                                    </a>
                                  </li>
                                {/each}
                              </ol>
                            </div>
                          </div>
                        </li>
                      {/if}
                    {/each}
                  </ol>
                {/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
</PanelOverlay>

{#if previewThumbnail}
  <div
    bind:this={previewElement}
    id={previewId}
    popover="manual"
    role="tooltip"
    class="toc-preview"
    onpointerenter={keepPreview}
    onpointerleave={leavePreview}
  >
    <img
      src={withBaseUrl(previewThumbnail.path)}
      alt={previewTarget?.element.textContent?.trim() ?? ""}
      width={previewThumbnail.width}
      height={previewThumbnail.height}
      onerror={hidePreview}
    />
  </div>
{/if}

<style>
  .toc-preview {
    position: fixed;
    inset: auto;
    margin: 0;
    width: 200px;
    max-width: calc(100vw - 24px);
    padding: 1px;
    border: 1px solid color-mix(in srgb, var(--app-overlay-icon) 25%, transparent);
    border-radius: 10px;
    background: var(--app-overlay-bg);
    box-shadow: 0 6px 24px #0003;
  }
  .toc-preview img { display: block; width: 100%; height: auto; border-radius: 8px; }

  .toc-row {
    display: flex;
    align-items: stretch;
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

  .toc-row > .toc-icon-button { height: auto; min-height: 2.5rem; }

  .toc-text-button {
    display: flex;
    align-items: center;
    min-height: 2.5rem;
    min-width: 0;
    flex: 1 1 0%;
    cursor: pointer;
    border-radius: 0.375rem;
    padding: 0.25rem 0.5rem;
    text-align: left;
    font-weight: 400;
    line-height: 1.35;
    text-decoration: none;
    transition: background-color 150ms ease;
  }

  .toc-text-button:hover {
    background: var(--app-overlay-selected-bg);
  }

  .toc-text-button-active .toc-title {
    text-decoration: underline;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.08em;
  }

  .toc-text-button--block {
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

  /* Keep links rendered for SSR while animating their intrinsic height. */
  .toc-disclosure {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows 240ms ease;
  }
  .toc-disclosure--expanded { grid-template-rows: 1fr; }
  .toc-chevron { display: inline-flex; transition: transform 240ms ease; }
  .toc-chevron--expanded { transform: rotate(90deg); }

  .toc-children {
    min-height: 0;
    overflow: hidden;
    margin-left: 0.75rem;
    padding-left: 0.75rem;
    border-left: 1px solid color-mix(in srgb, currentColor 16%, transparent);
  }
  .toc-number { flex: 0 0 auto; min-width: 1.4em; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--app-overlay-icon); }
  @media (prefers-reduced-motion: reduce) {
    .toc-disclosure, .toc-chevron { transition: none; }
  }
</style>
