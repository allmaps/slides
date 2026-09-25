<script lang="ts">
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import { tick } from "svelte";
  import { List, Play } from "@lucide/svelte";

  import AllmapsLogo from "$lib/components/AllmapsLogo.svelte";
  import type { StartScreenTextConfig } from "$lib/shared/types";

  type Props = {
    title: string;
    description?: string;
    chapterCount: number;
    visible: boolean;
    isDarkMode: boolean;
    text?: StartScreenTextConfig;
    onStart: () => void;
  };

  let {
    title,
    description,
    chapterCount,
    visible,
    isDarkMode,
    text,
    onStart,
  }: Props = $props();

  let startButton: HTMLButtonElement | undefined = $state();

  const startButtonLabel = $derived(text?.startButton ?? t("startButton"));
  const madeWithLabel = $derived(text?.madeWith ?? t("madeWith"));

  const chapterLabel = $derived(
    (chapterCount === 1
      ? text?.chapterCountSingular ?? t("chapterCountSingular")
      : text?.chapterCountPlural ?? t("chapterCountPlural")
    ).replaceAll("{count}", String(chapterCount)),
  );

  $effect(() => {
    if (!visible) return;

    let cancelled = false;

    void tick().then(() => {
      if (!cancelled) startButton?.focus({ preventScroll: true });
    });

    return () => {
      cancelled = true;
    };
  });
</script>

<section
  class="start-screen"
  class:start-screen--hidden={!visible}
  aria-labelledby="start-screen-title"
  aria-hidden={!visible}
  inert={!visible}
>
  <div class="start-card">
    {#if description}
      <p class="start-description">{description}</p>
    {/if}

    <h1 id="start-screen-title">{title}</h1>

    <p class="start-count">
      <List size={28} strokeWidth={1.5} aria-hidden="true" />
      <span>{chapterLabel}</span>
    </p>

    <button
      bind:this={startButton}
      type="button"
      class="start-button"
      onclick={onStart}
    >
      <Play size={25} strokeWidth={1.5} aria-hidden="true" />
      <span>{startButtonLabel}</span>
    </button>

    <p class="start-credit">
      <span>{madeWithLabel}</span>
      <AllmapsLogo inverted={isDarkMode} alt="" aria-hidden="true" />
      <span>{t("productName")}</span>
    </p>
  </div>
</section>

<style>
  .start-screen {
    pointer-events: auto;
    position: absolute;
    inset: 0;
    z-index: 30;
    display: grid;
    place-items: center;
    padding: var(--app-inset-top) var(--app-inset-right) var(--app-inset-bottom) var(--app-inset-left);
    opacity: 1;
    transform: scale(1);
    transition:
      opacity 350ms ease,
      transform 500ms ease;
  }

  .start-screen--hidden {
    pointer-events: none;
    opacity: 0;
    transform: scale(0.96);
  }

  .start-card {
    display: flex;
    width: min(45.4375rem, calc(100vw - 2rem));
    min-height: 26.1875rem;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 0.75rem;
    background: rgb(255 255 255 / 0.96);
    box-shadow: 0 0.25rem 0.75rem rgb(18 26 28 / 0.18);
    color: var(--app-black);
    padding: 2.5rem 2rem 1.5rem;
    text-align: center;
    backdrop-filter: blur(0.75rem);
  }

  .start-description,
  .start-count,
  .start-credit,
  .start-card h1 {
    margin: 0;
  }

  .start-description {
    overflow: hidden;
    max-width: 100%;
    color: var(--highlight-fg);
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .start-card h1 {
    margin-top: 1.25rem;
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    font-weight: 500;
    letter-spacing: -0.02em;
    line-height: 1;
  }

  .start-count {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 1.75rem;
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.1;
  }

  .start-count :global(svg) {
    flex: 0 0 auto;
    color: var(--highlight-fg);
  }

  .start-count span,
  .start-button span,
  .start-credit span {
    transform: translateY(0.06em);
  }

  .start-button {
    display: inline-flex;
    min-width: 7.5rem;
    height: 3.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    margin-top: 1.75rem;
    border-radius: 0.375rem;
    background: var(--highlight-fg);
    color: #fff;
    cursor: pointer;
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.1;
    padding-inline: 1rem;
    transition:
      filter 150ms ease,
      transform 150ms ease;
  }

  .start-button:hover {
    filter: brightness(0.94);
  }

  .start-button:active {
    transform: translateY(1px);
  }

  .start-button:focus-visible {
    outline: 2px solid var(--highlight-fg);
    outline-offset: 3px;
  }

  .start-credit {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    color: var(--app-interface-grey);
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.1;
  }

  .start-credit :global(.allmaps-logo) {
    width: 2rem;
    height: 2rem;
    opacity: 0.2;
  }

  :global(.dark) .start-card {
    width: min(38.9375rem, calc(100vw - 2rem));
    min-height: 24.6875rem;
    background: rgb(18 26 28 / 0.42);
    box-shadow: none;
    color: #fff;
    backdrop-filter: blur(1.25rem);
  }

  :global(.dark) .start-description,
  :global(.dark) .start-count :global(svg) {
    color: #fff;
  }

  :global(.dark) .start-credit {
    color: rgb(255 255 255 / 0.8);
  }

  :global(.dark) .start-credit :global(.allmaps-logo) {
    opacity: 0.8;
  }

  @media (max-width: 639px) {
    .start-card,
    :global(.dark) .start-card {
      min-height: 0;
      padding: 2.25rem 1.25rem 1.5rem;
    }

    .start-description,
    .start-count,
    .start-button,
    .start-credit {
      font-size: 1rem;
    }

    .start-card h1 {
      margin-top: 1rem;
    }

    .start-count,
    .start-button {
      margin-top: 1.35rem;
    }

    .start-credit {
      margin-top: 1.25rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .start-screen,
    .start-button {
      transition: none;
    }
  }
</style>
