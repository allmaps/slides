<script lang="ts">
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";
  import { tick } from "svelte";
  import { ArrowRight } from "@lucide/svelte";

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
          <div class="mt-6 flex flex-wrap gap-2">
            {#each subslideshows as subslideshow}
              <a
                class="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm leading-[1.1] font-medium text-[var(--highlight-fg)] hover:bg-[var(--app-hover-bg)]"
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
</div>
