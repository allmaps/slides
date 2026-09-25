<script lang="ts">
  import { provideChapter } from '$lib/shared/chapter-context';
  import type { MapChapter } from '$lib/shared/types';
  let { chapter, number, hiddenMapUrls, onShowMaps, onShowChapters }: {
    chapter: MapChapter; number?: string; hiddenMapUrls: string[]; onShowMaps: () => void; onShowChapters: () => void;
  } = $props();
  provideChapter({
    number: () => number,
    showChapters: () => onShowChapters(),
    mapCount: () => chapter.warpedMaps?.filter(map => !hiddenMapUrls.includes(map.url)).length ?? 0,
    showMaps: () => onShowMaps(),
  });
  const Component = $derived(chapter.Component);
</script>
<Component />
