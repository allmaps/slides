<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { tick } from "svelte";
  import { BookOpen, Presentation } from "@lucide/svelte";

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
    active?: boolean;
    overlayOpen?: boolean;
    scrollToTopSignal?: number;
    onTocClose?: () => void;
    onIndexChange?: (index: number) => void;
    class?: string;
  };

  type ChapterSubslideshow = {
    id: string;
    href: string;
    title: string;
    slideCount: number;
  };

  let {
    project,
    slideshow,
    active = true,
    overlayOpen = false,
    scrollToTopSignal = 0,
    onTocClose,
    onIndexChange,
    class: className = "",
  }: Props = $props();

  const chapters = $derived(slideshow.chapters);
  const firstChapter = $derived(chapters[0]);

  let index: number = $state(0);
  let loaded: boolean = $state(false);
  let scrollContainer: HTMLDivElement | undefined = $state();

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
            };
          })
          .filter((reference) => reference !== undefined)
      : [];

  const getSlideCountLabel = (count: number) =>
    `${count} ${count === 1 ? "slide" : "slides"}`;

  const closeToc = () => {
    onTocClose?.();
  };

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

  export const scrollToChapter = async (
    slug: string,
    behavior: ScrollBehavior = "smooth",
  ) => {
    await tick();

    const nextIndex = chapters.findIndex((chapter) => chapter.slug === slug);
    if (nextIndex >= 0) {
      setIndex(nextIndex);
    }

    scrollIntoView(slug, behavior);
  };

  export const scrollToTop = (behavior: ScrollBehavior = "smooth") => {
    scrollContainer?.scrollTo({ top: 0, behavior });
  };

  const replaceHash = (hash: string) => {
    const encodedHash = encodeURIComponent(hash);
    const nextUrl = `${window.location.pathname}${window.location.search}#${encodedHash}`;
    replaceState(nextUrl, page.state);
  };

  $effect(() => {
    if (active && loaded && currentSlug && getCurrentHash() !== currentSlug) {
      replaceHash(currentSlug);
    }
  });

  $effect(() => {
    scrollToTopSignal;

    if (!scrollToTopSignal || !active || !scrollContainer) return;

    scrollToTop();
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
  class="relative h-full min-h-0 text-[var(--app-text)] {className}"
>
  <div
    bind:this={scrollContainer}
    class="h-full min-h-0 overflow-x-hidden overflow-y-auto px-5 transition-opacity duration-150 {overlayOpen
      ? 'opacity-50'
      : 'opacity-100'}"
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
      >
        <Component />
        {#if subslideshows.length}
          <aside class="read-more" aria-label="Read more">
            <div class="read-more__heading">
              <BookOpen size={20} strokeWidth={1.8} aria-hidden="true" />
              <h2>Read more</h2>
            </div>
            <div class="read-more__list" aria-label="Subslideshows">
              {#each subslideshows as subslideshow}
                <a
                  class="read-more__card"
                  href={subslideshow.href}
                  aria-label={`${subslideshow.title}, ${getSlideCountLabel(subslideshow.slideCount)}`}
                  onclick={closeToc}
                >
                  <span class="read-more__preview" aria-hidden="true">
                    <span class="read-more__placeholder"></span>
                    <span class="read-more__count">
                      <Presentation
                        size={13}
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span class="read-more__count-text"
                        >{getSlideCountLabel(subslideshow.slideCount)}</span
                      >
                    </span>
                  </span>
                  <span class="read-more__title">{subslideshow.title}</span>
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
  </div>
</div>

<style>
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
