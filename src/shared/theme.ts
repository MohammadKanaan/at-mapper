import type { Theme } from "../types.js";

const THEME_NAMES: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  auto: "System",
};

export function resolveTheme(theme: Theme, mql: MediaQueryList | null): "light" | "dark" {
  if (theme === "auto") return mql?.matches ? "dark" : "light";
  return theme;
}

export function applyTheme(doc: Document, theme: Theme, mql: MediaQueryList | null): "light" | "dark" {
  const resolved = resolveTheme(theme, mql);
  doc.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

export function themeName(theme: Theme): string {
  return THEME_NAMES[theme];
}

export function themeLabel(theme: Theme, resolved: "light" | "dark"): string {
  return `${themeName(theme)} theme, currently ${resolved}. Change theme`;
}
