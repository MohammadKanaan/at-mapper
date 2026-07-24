export type Mappings = Record<string, string>;

export interface Settings {
  trigger: string;
  caseSensitive: boolean;
  fabEnabled: boolean;
  globalEnabledByDefault: boolean;
}

export type SiteOverrides = Record<string, boolean>;

export const DEFAULT_SETTINGS: Settings = {
  trigger: "@",
  caseSensitive: false,
  fabEnabled: true,
  globalEnabledByDefault: true,
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

export type EditorKind = "textarea" | "contenteditable";

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