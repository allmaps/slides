<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { tick, untrack } from "svelte";
  import { withBaseUrl } from "$lib/shared/paths";
  import { emptyThumbnails, slidePreviewKey, type ThumbnailManifest } from "$lib/shared/thumbnails";
  import ChapterContent from "$lib/components/ChapterContent.svelte";
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import { ArrowLeft, ArrowUp, BookOpen, Presentation } from "@lucide/svelte";

  import {
    getChapterRouteHref,
    getSlideshowRouteHref,
  } from "$lib/shared/project";
  import type {
    MapChapter,
    Project,
    Slideshow,
    SubslideshowReference,
  } from "$lib/shared/types";

  type Props = {
    thumbnails?: ThumbnailManifest;
    isDarkMode?: boolean;
    project: Project;
    slideshow: Slideshow;
    active?: boolean;
    suspended?: boolean;
    overlayOpen?: boolean;
    scrollToTopSignal?: number;
    onTocClose?: () => void;
    onIndexChange?: (index: number) => void;
    hiddenWarpedMapUrls?: string[];
    onShowLayers?: (slug: string) => void;
    backHref?: string;
    backTitle?: string;
    class?: string;
  };

  type ChapterSubslideshow = {
    id: string;
    href: string;
    title: string;
    slideCount: number;
    slideshow: Slideshow;
  };

  type ReadMoreCard = {
    previewKey?: string;
    id: string;
    href: string;
    title: string;
    badge: string;
    ariaLabel: string;
  };

  const SLIDE_CHANGE_DELAY_MS = 120;
  const SCROLL_IDLE_MS = 180;

  let {
    project,
    thumbnails = emptyThumbnails(),
    isDarkMode = false,
    slideshow,
    active = true,
    suspended = false,
    overlayOpen = false,
    scrollToTopSignal = 0,
    onTocClose,
    onIndexChange,
    hiddenWarpedMapUrls = [],
    onShowLayers,
    backHref,
    backTitle,
    class: className = "",
  }: Props = $props();

  const chapters = $derived(slideshow.chapters);
  const firstChapter = $derived(chapters[0]);

  let index: number = $state(0);
  let loaded: boolean = $state(false);
  let scrollContainer: HTMLDivElement | undefined = $state();
  let pendingHashScroll: string | undefined = $state();
  let navigationId = 0;
  let navigating = false;
  let scrollIdleTimeout: ReturnType<typeof setTimeout> | undefined;
  let indexUpdateTimeout: ReturnType<typeof setTimeout> | undefined;

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
    getSlideshowRouteHref(slideshow);

  const getChapterSubslideshows = (
    chapter: MapChapter,
  ): ChapterSubslideshow[] =>
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
              slideCount: subslideshow.chapters.length,
              slideshow: subslideshow,
            };
          })
          .filter((reference) => reference !== undefined)
      : [];

  const getSlideCountLabel = (count: number) =>
    t(count === 1 ? "slideCountSingular" : "slideCountPlural", { count });

  const getReadMoreCards = (
    subslideshows: ChapterSubslideshow[],
  ): ReadMoreCard[] => {
    if (
      subslideshows.length === 1 &&
      subslideshows[0].slideshow.chapters.length > 0
    ) {
      const subslideshow = subslideshows[0].slideshow;
      const slideCount = subslideshow.chapters.length;

      return subslideshow.chapters.map((chapter, index) => ({
        id: `${subslideshow.id}:${chapter.slug}`,
        previewKey: slidePreviewKey(subslideshow.id, chapter.slug),
        href: getChapterRouteHref(subslideshow, chapter),
        title: chapter.title,
        badge: `${index + 1} / ${slideCount}`,
        ariaLabel: t("slideCard", { title: chapter.title, current: index + 1, total: slideCount }),
      }));
    }

    return subslideshows.map((subslideshow) => ({
      id: subslideshow.id,
      previewKey: subslideshow.slideshow.chapters[0] ? slidePreviewKey(subslideshow.id, subslideshow.slideshow.chapters[0].slug) : undefined,
      href: subslideshow.href,
      title: subslideshow.title,
      badge: getSlideCountLabel(subslideshow.slideCount),
      ariaLabel: t("slideshowCard", { title: subslideshow.title, count: getSlideCountLabel(subslideshow.slideCount) }),
    }));
  };

  const closeToc = () => {
    onTocClose?.();
  };

  const getChapterIndexBySlug = (slug: string) =>
    chapters.findIndex((chapter) => chapter.slug === slug);

  const hashMatchesChapter = (hash: string) => getChapterIndexBySlug(hash) >= 0;

  const setIndex = (nextIndex: number) => {
    index = nextIndex;
    onIndexChange?.(nextIndex);
  };

  const decodeHash = (hash: string) => {
    const value = hash.startsWith("#") ? hash.slice(1) : hash;

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const getCurrentHash = () => decodeHash(window.location.hash);

  const getSectionBySlug = (slug: string) =>
    Array.from(scrollContainer?.querySelectorAll<HTMLElement>("section") ?? [])
      .find((section) => section.dataset.id === slug);

  const waitForNextFrame = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  const waitForFonts = async () => {
    await document.fonts?.ready;
  };

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

  const endNavigation = () => {
    navigationId += 1;
    navigating = false;
    clearTimeout(scrollIdleTimeout);
    clearTimeout(indexUpdateTimeout);
  };

  const waitForScrollIdle = () => {
    if (!navigating) return;
    clearTimeout(scrollIdleTimeout);
    const request = navigationId;
    scrollIdleTimeout = setTimeout(() => {
      if (request === navigationId) endNavigation();
    }, SCROLL_IDLE_MS);
  };

  const interruptNavigation = () => {
    if (!navigating) return;
    endNavigation();
    // Cancel native smooth scrolling before giving control back to the reader.
    scrollContainer?.scrollTo({ top: scrollContainer.scrollTop, behavior: "instant" });
    if (!scrollContainer) return;
    const center = scrollContainer.getBoundingClientRect().top + scrollContainer.clientHeight / 2;
    const section = Array.from(scrollContainer.querySelectorAll<HTMLElement>("section"))
      .findLast((element) => element.getBoundingClientRect().top <= center);
    if (section) setIndex(Number(section.dataset.index));
  };

  export const scrollToChapter = async (
    slug: string,
    behavior: ScrollBehavior = "smooth",
  ) => {
    const nextIndex = chapters.findIndex((chapter) => chapter.slug === slug);
    if (nextIndex < 0) return;

    endNavigation();
    const request = navigationId;
    navigating = true;
    // Publish the destination immediately so repeated navigation uses the
    // newest target, not a chapter crossed by an earlier smooth scroll.
    setIndex(nextIndex);
    await tick();
    if (request !== navigationId || !scrollContainer) return;

    scrollIntoView(slug, behavior);
    waitForScrollIdle();
  };

  export const scrollToTop = (behavior: ScrollBehavior = "smooth") => {
    const firstSlug = chapters[0]?.slug;
    if (firstSlug) void scrollToChapter(firstSlug, behavior);
  };

  const replaceHash = (hash?: string) => {
    const encodedHash = hash ? `#${encodeURIComponent(hash)}` : "";
    const nextUrl = `${window.location.pathname}${window.location.search}${encodedHash}`;
    replaceState(nextUrl, page.state);
  };

  $effect(() => {
    const hash = decodeHash(page.url.hash);

    if (!active || !loaded) return;
    if (!hash) {
      if (untrack(() => index) === 0) return;

      const firstSlug = chapters[0]?.slug;
      if (firstSlug) void scrollToChapter(firstSlug, "auto");
      return;
    }

    if (!hashMatchesChapter(hash)) return;
    if (hash === untrack(() => currentSlug)) return;

    pendingHashScroll = hash;
    void scrollToChapter(hash, "auto").finally(() => {
      if (pendingHashScroll === hash) {
        pendingHashScroll = undefined;
      }
    });
  });

  $effect(() => {
    if (!active || !loaded || !currentSlug) return;

    const hash = getCurrentHash();
    const nextHash = index === 0 ? "" : currentSlug;
    if (hash === nextHash) return;
    if (pendingHashScroll && hash === pendingHashScroll) return;

    replaceHash(nextHash || undefined);
  });

  $effect(() => {
    scrollToTopSignal;

    if (!scrollToTopSignal || !active || !scrollContainer) return;

    scrollToTop();
  });

  $effect(() => {
    const element = scrollContainer;
    if (!element) return;
    // Observe native scrolling gestures without overriding their default action.
    const onScrollKey = (event: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) interruptNavigation();
    };
    element.addEventListener("pointerdown", interruptNavigation, { passive: true });
    element.addEventListener("keydown", onScrollKey);
    return () => {
      element.removeEventListener("pointerdown", interruptNavigation);
      element.removeEventListener("keydown", onScrollKey);
    };
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
      const initialHashIndex = getChapterIndexBySlug(initialHash);

      if (initialHash && initialHashIndex >= 0) {
        await waitForFonts();
        if (cancelled || !scrollContainer) return;

        setIndex(initialHashIndex);
        scrollIntoView(initialHash, "auto");
        await waitForNextFrame();
        if (cancelled || !scrollContainer) return;

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
        if (suspended || navigating) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const elem = entry.target as HTMLElement;
            const nextIndex = Number(elem.dataset.index);

            if (indexUpdateTimeout !== undefined) {
              clearTimeout(indexUpdateTimeout);
            }

            indexUpdateTimeout = setTimeout(() => {
              indexUpdateTimeout = undefined;
              if (!cancelled && !suspended && !navigating) setIndex(nextIndex);
            }, SLIDE_CHANGE_DELAY_MS);
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
      endNavigation();
    };
  });
</script>

<div
  class="relative flex h-full min-h-0 flex-col text-[var(--app-text)] {className}"
  inert={!active || suspended}
>
  <div
    bind:this={scrollContainer}
    data-slideshow-scroll
    onscroll={waitForScrollIdle}
    onwheel={interruptNavigation}
    class="slideshow-scroll panel-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3.5 transition-opacity duration-150 {loaded
      ? ''
      : 'invisible'} {overlayOpen
      ? 'opacity-50'
      : 'opacity-100'}"
  >
    {#each chapters as chapter, index}
      {@const isActive = currentSlug === chapter.slug}
      {@const subslideshows = getChapterSubslideshows(chapter)}
      {@const readMoreCards = getReadMoreCards(subslideshows)}
      <section
        class="py-5 min-h-[60%] {isActive
          ? 'opacity-100'
          : 'opacity-40'} transition-opacity"
        data-index={index}
        id={active ? chapter.slug : undefined}
        data-id={chapter.slug}
      >
        {#if index === 0 && backHref}
          <a class="panel-link slideshow-heading" data-subslideshow-title href={backHref}
            title={t('backToTitle', { title: backTitle ?? '' })} aria-label={t('backToTitle', { title: backTitle ?? '' })}>
            <ArrowLeft size={20} aria-hidden="true" /><span>{slideshow.title}</span>
          </a>
        {/if}
        <ChapterContent {chapter} hiddenMapUrls={hiddenWarpedMapUrls} onShowMaps={() => onShowLayers?.(chapter.slug)} />
        {#if subslideshows.length}
          <aside class="read-more" aria-label={t("readMore")}>
            <div class="read-more__heading">
              <BookOpen size={20} strokeWidth={1.8} aria-hidden="true" />
              <h2>{t("readMore")}</h2>
            </div>
            <div
              class="read-more__list"
              aria-label={subslideshows.length === 1
                ? t("slides")
                : t("subslideshows")}
            >
              {#each readMoreCards as card (card.id)}
                {@const image = card.previewKey ? thumbnails.slides[card.previewKey]?.[isDarkMode ? "dark" : "light"] : undefined}
                <a
                  class="read-more__card"
                  href={card.href}
                  aria-label={card.ariaLabel}
                  onclick={closeToc}
                >
                  <span class="read-more__preview" aria-hidden="true">
                    {#if image}
                      <img class="read-more__image" src={withBaseUrl(image.path)} width={image.width} height={image.height} alt="" loading="lazy" decoding="async" />
                    {:else}
                    <span class="read-more__placeholder"></span>
                    {/if}
                    <span class="read-more__count">
                      <Presentation
                        size={13}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span class="read-more__count-text"
                        >{card.badge}</span
                      >
                    </span>
                  </span>
                  <span class="read-more__title">{card.title}</span>
                </a>
              {/each}
            </div>
          </aside>
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
    <footer class="panel-footer">
      {#if backHref}<a class="panel-link" href={backHref}><ArrowLeft size={20} aria-hidden="true" /><span>{t('backToMain')}</span></a>{/if}
      <button class="panel-link panel-footer__top" type="button" onclick={() => scrollToTop()}><ArrowUp size={20} aria-hidden="true" /><span>{t('scrollToTop')}</span></button>
    </footer>
  </div>
</div>

<style>
  .slideshow-scroll {
    /* A mobile card can scroll behind the navigator. Leave enough room for
       its footer to scroll into view; separated panels only need normal padding. */
    padding-bottom: var(--panel-scroll-clearance, calc(var(--navigator-height, 62px) + 16px));
    margin-inline: 6px;
    width: calc(100% - 12px);
    scroll-padding-bottom: var(--panel-scroll-clearance, calc(var(--navigator-height, 62px) + 16px));
  }

  .panel-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--app-breadcrumb);
    font-size: 18px;
    line-height: 1.2;
    text-align: left;
    cursor: pointer;
  }
  .panel-link span { transform: translateY(0.08em); }
  .panel-link :global(svg) { flex-shrink: 0; }
  .panel-link:hover { text-decoration: underline; }
  .slideshow-heading { margin-bottom: 24px; }
  .panel-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-block: 24px 8px; }
  .panel-footer__top { margin-left: auto; }

  .read-more {
    margin-top: 1.75rem;
  }

  .read-more__heading {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--highlight-fg);
  }

  .read-more__heading h2 {
    font-family: var(--font-display);
    font-feature-settings: var(--font-display-features);
    font-size: 1.375rem;
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: 0;
    transform: translateY(0.04em);
  }

  .read-more__list {
    display: grid;
    grid-auto-columns: minmax(8.5rem, 9.75rem);
    grid-auto-flow: column;
    gap: 0.55rem;
    margin-top: 0.65rem;
    margin-right: -1.25rem;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding-right: 1.25rem;
    padding-bottom: 0.15rem;
    scrollbar-width: none;
  }

  .read-more__list::-webkit-scrollbar {
    display: none;
  }

  .read-more__card {
    display: block;
    min-width: 0;
    color: var(--highlight-fg);
    text-decoration: none;
  }

  .read-more__preview {
    position: relative;
    display: block;
    width: 100%;
    overflow: hidden;
    aspect-ratio: 1.35;
    border-radius: 0.375rem;
    background: var(--app-hover-bg);
  }

  .read-more__image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .read-more__placeholder {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(
        135deg,
        color-mix(in srgb, var(--highlight-fg) 26%, transparent),
        transparent 52%
      ),
      color-mix(in srgb, var(--app-text) 8%, transparent);
  }

  .read-more__count {
    position: absolute;
    bottom: 0.4rem;
    left: 0.4rem;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: calc(100% - 0.8rem);
    border-radius: 0.175rem;
    background: rgb(18 26 28 / 0.3);
    color: #fff;
    padding: 0.2rem 0.35rem;
    font-size: 0.8125rem;
    font-weight: 500;
    line-height: 1;
    white-space: nowrap;
  }

  .read-more__count-text {
    transform: translateY(0.08em);
  }

  .read-more__title {
    display: block;
    margin-top: 0.45rem;
    overflow: hidden;
    font-family: var(--font-display);
    font-feature-settings: var(--font-display-features);
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.1;
    letter-spacing: 0;
    text-overflow: ellipsis;
  }

  .read-more__card:hover .read-more__title {
    text-decoration: underline;
    text-decoration-thickness: 0.06em;
    text-underline-offset: 0.12em;
  }

  :global(.dark) .read-more__heading,
  :global(.dark) .read-more__title {
    color: var(--app-text);
  }

  :global(.dark) .read-more__preview {
    background: rgb(255 255 255 / 0.1);
  }

  :global(.dark) .read-more__placeholder {
    background:
      linear-gradient(135deg, rgb(255 255 255 / 0.12), transparent 52%),
      rgb(255 255 255 / 0.08);
  }
</style>
