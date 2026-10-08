import type { Theme } from "../types.js";

const THEME_NAMES: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
};

/** The system preference, used to pick a theme on the first run. */
export function systemTheme(): Theme {
  return typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** The only other theme — the toggle flips between the two. */
export function nextTheme(theme: Theme): Theme {
  return theme === "dark" ? "light" : "dark";
}

export function applyTheme(doc: Document, theme: Theme): void {
  doc.documentElement.setAttribute("data-theme", theme);
}

export function themeName(theme: Theme): string {
  return THEME_NAMES[theme];
}

export function themeLabel(theme: Theme): string {
  return `${themeName(theme)} theme — switch to ${nextTheme(theme)}`;
}
