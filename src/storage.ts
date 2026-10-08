import { b } from "./browser.js";
import { systemTheme } from "./shared/theme.js";
import {
  DEFAULT_SETTINGS,
  EXPORT_VERSION,
  type ExportPayload,
  type ImportMode,
  type ImportResult,
  type Mappings,
  type Settings,
  type SiteOverrides,
  STORAGE_KEYS,
  type Theme,
} from "./types.js";

export async function loadMappings(): Promise<Mappings> {
  const { [STORAGE_KEYS.mappings]: raw } = await b.storage.local.get(STORAGE_KEYS.mappings);
  if (raw && typeof raw === "object") return raw as Mappings;
  return {};
}

export async function saveMappings(m: Mappings): Promise<void> {
  await b.storage.local.set({ [STORAGE_KEYS.mappings]: m });
}

/**
 * Themes are always concrete. A stored or exported "auto" (or anything else
 * unrecognised, including a missing value) becomes the system preference.
 */
function concreteTheme(value: unknown): Theme {
  return value === "light" || value === "dark" ? value : systemTheme();
}

export async function loadSettings(): Promise<Settings> {
  const { [STORAGE_KEYS.settings]: raw } = await b.storage.sync.get(STORAGE_KEYS.settings);
  if (raw && typeof raw === "object") {
    const partial = raw as Partial<Settings>;
    return { ...DEFAULT_SETTINGS, ...partial, theme: concreteTheme(partial.theme) };
  }
  return { ...DEFAULT_SETTINGS, theme: systemTheme() };
}

export async function saveSettings(s: Settings): Promise<void> {
  await b.storage.sync.set({ [STORAGE_KEYS.settings]: s });
}

export async function loadSiteOverrides(): Promise<SiteOverrides> {
  const { [STORAGE_KEYS.siteOverrides]: raw } = await b.storage.sync.get(STORAGE_KEYS.siteOverrides);
  if (raw && typeof raw === "object") return raw as SiteOverrides;
  return {};
}

export async function saveSiteOverrides(o: SiteOverrides): Promise<void> {
  await b.storage.sync.set({ [STORAGE_KEYS.siteOverrides]: o });
}

type StorageChange<T> = { oldValue?: T; newValue?: T };
type StorageChanges = Record<string, StorageChange<unknown>>;

export function onStorageChanged(
  cb: (changes: { mappings?: Mappings; settings?: Settings; siteOverrides?: SiteOverrides }) => void,
): () => void {
  const listener = (changes: StorageChanges, area: string) => {
    const out: { mappings?: Mappings; settings?: Settings; siteOverrides?: SiteOverrides } = {};
    if (area === "local" && STORAGE_KEYS.mappings in changes) {
      out.mappings = changes[STORAGE_KEYS.mappings].newValue as Mappings | undefined;
    }
    if (area === "sync") {
      if (STORAGE_KEYS.settings in changes) out.settings = changes[STORAGE_KEYS.settings].newValue as Settings | undefined;
      if (STORAGE_KEYS.siteOverrides in changes) out.siteOverrides = changes[STORAGE_KEYS.siteOverrides].newValue as SiteOverrides | undefined;
    }
    if (Object.keys(out).length > 0) cb(out);
  };
  b.storage.onChanged.addListener(listener);
  return () => b.storage.onChanged.removeListener(listener);
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const [mappings, settings, siteOverrides] = await Promise.all([
    loadMappings(),
    loadSettings(),
    loadSiteOverrides(),
  ]);
  return { version: EXPORT_VERSION, mappings, settings, siteOverrides };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateImportPayload(payload: ExportPayload): string | null {
  if (!isPlainObject(payload)) return "Invalid payload";
  if (payload.version !== EXPORT_VERSION) return `Unsupported version ${payload.version}`;
  if (!isPlainObject(payload.mappings)) return "Invalid mappings";
  if (!Object.values(payload.mappings).every((v) => typeof v === "string")) {
    return "Invalid mappings: every replacement must be text";
  }
  if (payload.settings !== undefined && !isPlainObject(payload.settings)) return "Invalid settings";
  if (payload.siteOverrides !== undefined) {
    if (!isPlainObject(payload.siteOverrides)) return "Invalid site overrides";
    if (!Object.values(payload.siteOverrides).every((v) => typeof v === "boolean")) {
      return "Invalid site overrides: every value must be true or false";
    }
  }
  return null;
}

export async function applyImport(payload: ExportPayload, mode: ImportMode): Promise<ImportResult> {
  const error = validateImportPayload(payload);
  if (error) return { ok: false, error };

  const importedSettings = payload.settings ?? {};
  const importedOverrides = payload.siteOverrides ?? {};
  try {
    if (mode === "replace") {
      await saveMappings(payload.mappings);
      await saveSettings({ ...DEFAULT_SETTINGS, ...importedSettings, theme: concreteTheme(importedSettings.theme) });
      await saveSiteOverrides(importedOverrides);
    } else {
      await saveMappings({ ...(await loadMappings()), ...payload.mappings });
      const merged = { ...(await loadSettings()), ...importedSettings };
      await saveSettings({ ...merged, theme: concreteTheme(importedSettings.theme ?? merged.theme) });
      await saveSiteOverrides({ ...(await loadSiteOverrides()), ...importedOverrides });
    }
    return {
      ok: true,
      imported: {
        mappings: Object.keys(payload.mappings).length,
        siteOverrides: Object.keys(importedOverrides).length,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function exportToFile(): Promise<void> {
  const payload = await buildExportPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `at-mapper-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importFromFile(file: File, mode: ImportMode): Promise<ImportResult> {
  const text = await file.text();
  let payload: ExportPayload;
  try {
    payload = JSON.parse(text) as ExportPayload;
  } catch {
    return { ok: false, error: "File is not valid JSON" };
  }
  return applyImport(payload, mode);
}