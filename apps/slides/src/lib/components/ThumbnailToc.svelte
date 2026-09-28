<script lang="ts">
  import { ChevronRight, ListChevronsDownUp, ListChevronsUpDown } from "@lucide/svelte";
  import { getChapterLabel } from "@allmaps/slides/model/project";
  import type { Project } from "@allmaps/slides/model/types";
  import { thumbnailShowAnchor, thumbnailSlideAnchor, type thumbnailOverview } from "$lib/shared/thumbnail-overview";
  import type { InterfaceText } from "$lib/shared/interface-settings";

  let { project, shows, t }: { project: Project; shows: ReturnType<typeof thumbnailOverview>; t: InterfaceText } = $props();
  let expanded = $state<string[]>([]);
  const expandable = $derived(shows.filter(show => show.chapters.length || show.startImages.length).map(show => show.id));
  const allExpanded = $derived(expandable.length > 0 && expandable.every(id => expanded.includes(id)));
  const toggle = (id: string) => { expanded = expanded.includes(id) ? expanded.filter(value => value !== id) : [...expanded, id]; };
</script>

<nav class="thumbnail-toc" aria-label={t("chapters")}>
  <div class="toc-heading">
    <h2>{t("chapters")}</h2>
    {#if expandable.length}
      <button type="button" aria-label={t(allExpanded ? "collapseAll" : "expandAll")} title={t(allExpanded ? "collapseAll" : "expandAll")}
        onclick={() => { expanded = allExpanded ? [] : expandable; }}>
        {#if allExpanded}<ListChevronsDownUp size={22} aria-hidden="true" />{:else}<ListChevronsUpDown size={22} aria-hidden="true" />{/if}
      </button>
    {/if}
  </div>
  <ol class="toc-scroll">
    {#each shows as show, showIndex}
      {@const open = expanded.includes(show.id)}
      <li>
        <div class="toc-row">
          <a href={`#${thumbnailShowAnchor(showIndex)}`}>{show.title}</a>
          {#if expandable.includes(show.id)}
            <button type="button" aria-label={`${t(open ? "collapse" : "expand")}: ${show.title}`} aria-expanded={open}
              aria-controls={`${thumbnailShowAnchor(showIndex)}-contents`} onclick={() => toggle(show.id)}>
              <ChevronRight size={22} class={open ? "chevron open" : "chevron"} aria-hidden="true" />
            </button>
          {/if}
        </div>
        <div id={`${thumbnailShowAnchor(showIndex)}-contents`} class="toc-disclosure" class:expanded={open} aria-hidden={!open} inert={!open}>
          <ol class="toc-chapters">
            {#if show.startImages.length}<li><a href={`#${thumbnailSlideAnchor(showIndex, "start")}`}>{t("thumbnailStart")}</a></li>{/if}
            {#each show.chapters as chapter, index}
              <li><a href={`#${thumbnailSlideAnchor(showIndex, index)}`}><span class="chapter-number">{getChapterLabel(project, show, chapter.slug)}.</span>{chapter.title}</a></li>
            {/each}
          </ol>
        </div>
      </li>
    {/each}
  </ol>
</nav>

<style>
  .thumbnail-toc { max-width: 640px; border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 12px; padding: 8px 12px; margin: 24px 0 36px; }
  .toc-heading, .toc-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .toc-heading h2 { font: 22px/1.2 var(--font-display); margin: 8px; }
  button { display: grid; place-items: center; flex: 0 0 44px; width: 44px; height: 44px; border-radius: 6px; cursor: pointer; }
  a { display: flex; align-items: baseline; gap: 8px; padding: 10px 8px; min-height: 44px; overflow-wrap: anywhere; border-radius: 6px; text-decoration: none; }
  .toc-row > a { flex: 1; min-width: 0; }
  .toc-chapters a { padding-left: 20px; }
  .chapter-number { flex: none; opacity: .65; }
  button:hover, a:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
  :is(button, a):focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .toc-scroll { max-height: 280px; overflow-y: auto; scrollbar-width: thin; scrollbar-color: transparent transparent; }
  .toc-scroll:hover, .toc-scroll:focus-within { scrollbar-color: color-mix(in srgb, currentColor 30%, transparent) transparent; }
  .toc-disclosure { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 180ms ease; }
  .toc-disclosure.expanded { grid-template-rows: 1fr; }
  .toc-chapters { min-height: 0; overflow: hidden; }
  :global(.thumbnail-toc .chevron) { transition: transform 180ms ease; }
  :global(.thumbnail-toc .chevron.open) { transform: rotate(90deg); }
  @media (prefers-reduced-motion: reduce) { .toc-disclosure, :global(.thumbnail-toc .chevron) { transition: none; } }
</style>
