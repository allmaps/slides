import { DEFAULT_COLORS } from "./settings.ts";

export type ThemeName = keyof typeof DEFAULT_COLORS;
export type ThemeColors = { fg: string; bg: string };
export type ThemeConfig = ThemeName | ThemeColors;

export const THEME_NAMES = Object.keys(DEFAULT_COLORS) as ThemeName[];

/** UI accent colors are independent of the map style and light/dark mode. */
export function resolveTheme(theme: ThemeConfig = "green"): ThemeColors {
  if (typeof theme !== "string") return { ...theme };
  const { stroke, fill } = DEFAULT_COLORS[theme];
  return { fg: stroke, bg: fill };
}
