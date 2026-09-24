import { getContext, setContext } from 'svelte';
import type { InterfaceConfig } from './types';
import { createInterfaceText, type InterfaceText } from './interface-settings.ts';

const key = Symbol('slides-interface');
export const provideInterfaceText = (config: () => InterfaceConfig | undefined) =>
  setContext(key, createInterfaceText(config));
export const getInterfaceText = (): InterfaceText => getContext(key) ?? createInterfaceText();
