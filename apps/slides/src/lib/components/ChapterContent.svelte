<script lang="ts">
  import { provideChapter } from '$lib/shared/chapter-context';
  import type { MapChapter } from '$lib/shared/types';
  let { chapter, number, onShowMaps, onShowChapters }: {
    chapter: MapChapter; number?: string; onShowMaps: () => void; onShowChapters: () => void;
  } = $props();
  provideChapter({
    number: () => number,
    showChapters: () => onShowChapters(),
    mapCount: () => chapter.warpedMaps?.length ?? 0,
    showMaps: () => onShowMaps(),
  });
  const Component = $derived(chapter.Component);
</script>
<Component />
