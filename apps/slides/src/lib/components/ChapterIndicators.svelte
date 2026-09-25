<script lang="ts">
  import { ListTree } from '@lucide/svelte';
  import icon from '$lib/assets/navigator/map-count.svg';
  import { getChapter } from '$lib/shared/chapter-context';
  import { getInterfaceText } from '$lib/shared/interface-context';
  const chapter = getChapter();
  const t = getInterfaceText();
  const number = $derived(chapter?.number());
  const mapCount = $derived(chapter?.mapCount() ?? 0);
</script>
{#if chapter}
  <span class="chapter-indicators">
    {#if number}
      <button type="button" class="chapter-indicator" aria-label={t('chapterNumber', { number })}
        title={t('chapters')} onclick={chapter.showChapters}>
        <span class="chapter-indicator__icon"><ListTree size={18} aria-hidden="true" /></span><span class="chapter-indicator__number">{number}{number.includes('.') ? '' : '.'}</span>
      </button>
    {/if}
    {#if mapCount > 0}
      <button type="button" class="chapter-indicator" aria-label={t('mapCount', { count: mapCount })}
        title={t('mapLayers')} onclick={chapter.showMaps}>
        <span class="chapter-indicator__icon"><img src={icon} alt="" /></span><span class="chapter-indicator__number">{t(mapCount === 1 ? 'mapCountSingular' : 'mapCountPlural', { count: mapCount })}</span>
      </button>
    {/if}
  </span>
{/if}
<style>
  .chapter-indicators { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin: 8px 0 0 -8px; }
  .chapter-indicator { display: flex; width: fit-content; min-width: 44px; min-height: 44px; align-items: center; justify-content: center; gap: 5px; padding: 6px 8px; border-radius: 8px; color: var(--app-muted); cursor: pointer; font: 500 16px/1.1 var(--font-display); white-space: nowrap; }
  .chapter-indicator:hover { background: var(--app-hover-bg); }
  .chapter-indicator { -webkit-user-select: none; user-select: none; }
  .chapter-indicator:focus-visible { outline: 2px solid var(--highlight-fg); }
  .chapter-indicator__icon { width: 18px; height: 20px; display: grid; place-items: center; }
  .chapter-indicator__icon img { display: block; width: 100%; height: 100%; object-fit: contain; }
  .chapter-indicator__number { transform: translateY(0.08em); }
</style>
