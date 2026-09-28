import { DEFAULT_COLORS } from "./settings.ts";
import type { ThemeMode } from "./types.ts";

export type ThemeName = keyof typeof DEFAULT_COLORS;
export type ThemeColors = { fg: string; bg: string };
export type ThemePalette = ThemeName | ThemeColors;
export type ThemeConfig = ThemePalette | { light?: ThemePalette; dark?: ThemePalette };

export const THEME_NAMES = Object.keys(DEFAULT_COLORS) as ThemeName[];

/** Dark mode falls back to the light palette; UI colors are independent of map styles. */
export function resolveTheme(theme: ThemeConfig = "green", mode: ThemeMode = "light"): ThemeColors {
  const palette = typeof theme === "string" || "fg" in theme
    ? theme : theme[mode] ?? theme.light ?? "green";
  if (typeof palette !== "string") return { ...palette };
  const { stroke, fill } = DEFAULT_COLORS[palette];
  return { fg: stroke, bg: fill };
}
