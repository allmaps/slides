<script lang="ts">
  import icon from '$lib/assets/navigator/map-count.svg';
  import { getChapter } from '$lib/shared/chapter-context';
  import { getInterfaceText } from '$lib/shared/interface-context';
  const chapter = getChapter();
  const t = getInterfaceText();
</script>
{#if chapter}
  <button type="button" class="map-count" aria-label={t('mapCount', { count: chapter.mapCount() })}
    title={t('mapLayers')} onclick={chapter.showMaps}>
    <span class="map-count__icon"><img src={icon} alt="" /></span><span class="map-count__number">{chapter.mapCount()}</span>
  </button>
{/if}
<style>
  .map-count { display: flex; width: fit-content; align-items: center; gap: 5px; margin-top: 8px; padding-block: 4px; border-radius: 5px; color: var(--app-muted); cursor: pointer; font: 500 16px/1.1 var(--font-display); white-space: nowrap; }
  .map-count:hover { background: var(--app-hover-bg); }
  .map-count:focus-visible { outline: 2px solid var(--highlight-fg); }
  .map-count__icon { width: 18px; height: 20px; display: grid; place-items: center; }
  .map-count__number { transform: translateY(0.08em); }
</style>
