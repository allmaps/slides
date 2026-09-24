<script lang="ts">
  import { provideChapter } from '$lib/shared/chapter-context';
  import type { MapChapter } from '$lib/shared/types';
  let { chapter, hiddenMapUrls, onShowMaps }: {
    chapter: MapChapter; hiddenMapUrls: string[]; onShowMaps: () => void;
  } = $props();
  provideChapter({
    mapCount: () => chapter.warpedMaps?.filter(map => !hiddenMapUrls.includes(map.url)).length ?? 0,
    showMaps: () => onShowMaps(),
  });
  const Component = $derived(chapter.Component);
</script>
<Component />
