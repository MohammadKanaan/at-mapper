export type Mappings = Record<string, string>;

export type Theme = "light" | "dark";

export interface Settings {
  trigger: string;
  caseSensitive: boolean;
  globalEnabledByDefault: boolean;
  theme: Theme;
}

export type SiteOverrides = Record<string, boolean>;

export const DEFAULT_SETTINGS: Settings = {
  trigger: "@",
  caseSensitive: false,
  globalEnabledByDefault: true,
  /**
   * Placeholder theme. The first run adopts the system preference instead
   * (see `concreteTheme()` in storage.ts); a stored choice always wins.
   */
  theme: "light",
};

export const STORAGE_KEYS = {
  mappings: "atm_mappings",
  settings: "atm_settings",
  siteOverrides: "atm_site_overrides",
} as const;

export const EXPORT_VERSION = 1;

export interface ExportPayload {
  version: typeof EXPORT_VERSION;
  mappings: Mappings;
  settings: Settings;
  siteOverrides: SiteOverrides;
}

export type ImportMode = "merge" | "replace";

export interface ImportResult {
  ok: boolean;
  error?: string;
  imported?: { mappings: number; siteOverrides: number };
}

export type EditorKind = "textarea" | "contenteditable" | "input";

export interface EditorTarget {
  el: HTMLElement;
  kind: EditorKind;
}

export interface CaretCoords {
  left: number;
  top: number;
  bottom: number;
  height: number;
}

export interface TokenContext {
  trigger: string;
  word: string;
  start: number;
  end: number;
}