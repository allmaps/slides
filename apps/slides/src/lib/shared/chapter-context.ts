import { getContext, setContext } from 'svelte';

const key = Symbol('slides-chapter');
export type ChapterContext = {
  number: () => string | undefined;
  showChapters: () => void;
  mapCount: () => number;
  showMaps: () => void;
};
export const provideChapter = (context: ChapterContext) => setContext(key, context);
export const getChapter = (): ChapterContext | undefined => getContext(key);
