<script lang="ts">
  import { getInterfaceText } from "$lib/shared/interface-context";
  const t = getInterfaceText();
  import { ArrowLeft, Eye, EyeOff, Layers, ListTree, Moon, Sun } from "@lucide/svelte";
  import menuIcon from "$lib/assets/navigator/menu.svg";
  import previousIcon from "$lib/assets/navigator/previous.svg";
  import nextIcon from "$lib/assets/navigator/next.svg";
  import infoIcon from "$lib/assets/navigator/info.svg";
  import { getChapterRouteHref } from "$lib/shared/project";
  import type { Slideshow } from "$lib/shared/types";

  let {
    slideshow, index, panelVisible, isDarkMode, creditsOpen,
    backHref, backTitle, onNavigate, onLayers, onChapters, onTheme,
    onTogglePanel, onCredits, onMenuOpen,
  }: {
    slideshow: Slideshow;
    index: number;
    panelVisible: boolean;
    isDarkMode: boolean;
    creditsOpen: boolean;
    backHref?: string;
    backTitle?: string;
    onNavigate: (slug: string) => void;
    onLayers: () => void;
    onChapters: () => void;
    onTheme: () => void;
    onTogglePanel: () => void;
    onCredits: () => void;
    onMenuOpen: () => void;
  } = $props();

  let menuOpen = $state(false);
  let element: HTMLElement;
  let menuButton: HTMLButtonElement;
  const id = $props.id();
  const menuId = `${id}-menu`;
  const previous = $derived(slideshow.chapters[index - 1]);
  const next = $derived(slideshow.chapters[index + 1]);

  const closeMenu = (restoreFocus = false) => {
    menuOpen = false;
    if (restoreFocus) menuButton?.focus();
  };
  const choose = (action: () => void) => {
    closeMenu(true);
    action();
  };
  const navigate = (event: MouseEvent, slug: string) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    closeMenu();
    onNavigate(slug);
  };
</script>

<svelte:window
  onpointerdown={(event) => {
    if (menuOpen && event.target instanceof Node && !element?.contains(event.target)) closeMenu();
  }}
  onkeydown={(event) => {
    if (event.key === "Escape" && menuOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  }}
/>

<nav bind:this={element} class="slideshow-navigator" class:slideshow-navigator--collapsed={!panelVisible} aria-label={t("navigation")}>
  {#if menuOpen}
    <div class="navigator-menu" id={menuId} aria-label={t("options")}>
      {#if backHref}
        <a aria-keyshortcuts="b" href={backHref} onclick={() => closeMenu()}>
          <ArrowLeft size={22} aria-hidden="true" /><span>{t("backToTitle", { title: backTitle ?? "" })}</span>
        </a>
      {/if}
      <button type="button" onclick={() => choose(onLayers)}>
        <Layers size={22} aria-hidden="true" /><span>{t("mapLayers")}</span>
      </button>
      <button type="button" onclick={() => choose(onChapters)}>
        <ListTree size={22} aria-hidden="true" /><span>{t("chapters")}</span>
      </button>
      <button type="button" onclick={() => choose(onTheme)}>
        {#if isDarkMode}<Sun size={22} aria-hidden="true" />{:else}<Moon size={22} aria-hidden="true" />{/if}
        <span>{t(isDarkMode ? "lightMode" : "darkMode")}</span>
      </button>
      <button type="button" aria-keyshortcuts="h" aria-controls="slideshow-reading-panel" aria-expanded={panelVisible} onclick={() => choose(onTogglePanel)}>
        {#if panelVisible}<EyeOff size={22} aria-hidden="true" />{:else}<Eye size={22} aria-hidden="true" />{/if}
        <span>{t(panelVisible ? "hideSidePanel" : "showSidePanel")}</span>
      </button>
    </div>
  {/if}
  <button
    bind:this={menuButton}
    type="button"
    class="navigator-button"
    class:active={menuOpen}
    aria-label={t(menuOpen ? "closeMenu" : "openMenu")}
    title={t(menuOpen ? "closeMenu" : "openMenu")}
    aria-expanded={menuOpen}
    aria-controls={menuId}
    onclick={() => {
      menuOpen = !menuOpen;
      if (menuOpen) onMenuOpen();
    }}
  ><img src={menuIcon} width="32" height="32" alt="" /></button>

  <div class="navigator-pagination">
    {#if previous}
      <a class="navigator-button" aria-keyshortcuts="ArrowLeft" href={getChapterRouteHref(slideshow, previous)} aria-label={t("previousChapterTitle", { title: previous.title })} title={t("previousChapterTitle", { title: previous.title })} onclick={(event) => navigate(event, previous.slug)}>
        <img class="previous-icon" src={previousIcon} width="25" height="25" alt="" />
      </a>
    {:else}
      <button class="navigator-button" type="button" disabled aria-label={t("previousChapter")}><img class="previous-icon" src={previousIcon} width="25" height="25" alt="" /></button>
    {/if}
    <span class="navigator-position"><span class="navigator-count" aria-live="polite" aria-atomic="true" aria-label={t("chapterPosition", { current: slideshow.chapters.length ? index + 1 : 0, total: slideshow.chapters.length })}>
      {t("chapterCounter", { current: slideshow.chapters.length ? index + 1 : 0, total: slideshow.chapters.length })}
    </span>
      <progress class="navigator-progress" max={Math.max(1, slideshow.chapters.length)} value={slideshow.chapters.length ? index + 1 : 0} aria-label={t("slideshowProgress")}></progress>
    </span>
    {#if next}
      <a class="navigator-button" aria-keyshortcuts="ArrowRight" href={getChapterRouteHref(slideshow, next)} aria-label={t("nextChapterTitle", { title: next.title })} title={t("nextChapterTitle", { title: next.title })} onclick={(event) => navigate(event, next.slug)}>
        <img src={nextIcon} width="24" height="25" alt="" />
      </a>
    {:else}
      <button class="navigator-button" type="button" disabled aria-label={t("nextChapter")}><img src={nextIcon} width="24" height="25" alt="" /></button>
    {/if}
  </div>

  <button class="navigator-button" class:active={creditsOpen} type="button" aria-label={t(creditsOpen ? "closeCredits" : "openCredits")} title={t("credits")} aria-expanded={creditsOpen} onclick={() => { closeMenu(); onCredits(); }}>
    <img src={infoIcon} width="22" height="22" alt="" />
  </button>
</nav>

<style>
  .slideshow-navigator {
    position: absolute;
    inset: auto 0 0;
    z-index: 50;
    display: flex;
    height: var(--navigator-height, 62px);
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    border-radius: 17px;
    padding: 3px 8px;
    background: var(--app-navigator-bg);
    color: var(--app-text);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    pointer-events: auto;
  }
  .navigator-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    cursor: pointer;
  }
  .navigator-button:hover, .navigator-button.active,
  .navigator-menu button:hover, .navigator-menu a:hover {
    background: var(--app-overlay-selected-bg);
  }
  .navigator-button:focus-visible, .navigator-menu button:focus-visible, .navigator-menu a:focus-visible {
    outline: 2px solid var(--highlight-fg);
    outline-offset: -2px;
  }
  .navigator-button:disabled { opacity: 0.3; cursor: default; background: none; }
  .navigator-button img { display: block; flex-shrink: 0; }
  .previous-icon { transform: rotate(90deg); }
  .navigator-pagination { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .navigator-count { min-width: 70px; padding-top: 0.15em; text-align: center; font-size: 18px; white-space: nowrap; }
  .navigator-menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 6px);
    max-width: 100%;
    max-height: calc(100dvh - 110px);
    overflow-y: auto;
    width: max-content;
    border-radius: 17px;
    padding: 8px;
    background: var(--app-overlay-bg);
    backdrop-filter: blur(12px);
  }
  .navigator-menu button, .navigator-menu a {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 38px;
    border-radius: 8px;
    padding: 6px 12px;
    text-align: left;
    font-size: 16px;
    line-height: 1.2;
    cursor: pointer;
  }
  .navigator-menu span { padding-top: 0.15em; }
  .navigator-menu :global(svg) { flex-shrink: 0; }
  .navigator-position { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .navigator-progress { appearance: none; display: block; width: 70px; height: 5px; border: 0; border-radius: 3px; overflow: hidden; background: color-mix(in srgb, var(--highlight-fg) 22%, transparent); color: var(--highlight-fg); }
  .navigator-progress::-webkit-progress-bar { background: color-mix(in srgb, var(--highlight-fg) 22%, transparent); border-radius: 3px; }
  .navigator-progress::-webkit-progress-value { background: var(--highlight-fg); border-radius: 3px; transition: width 180ms ease; }
  .navigator-progress::-moz-progress-bar { background: var(--highlight-fg); border-radius: 3px; }
  .navigator-button img { filter: brightness(0); opacity: .65; }
  :global(.dark) .navigator-button img { filter: brightness(0) invert(1); opacity: 1; }
  @media (max-width: 767px) {
    .slideshow-navigator--collapsed .navigator-progress { display: none; }
    .slideshow-navigator--collapsed .navigator-position { transform: translateY(5px); }
  }
</style>
