import { b } from "./browser.js";
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
} from "./types.js";

export async function loadMappings(): Promise<Mappings> {
  const { [STORAGE_KEYS.mappings]: raw } = await b.storage.local.get(STORAGE_KEYS.mappings);
  if (raw && typeof raw === "object") return raw as Mappings;
  return {};
}

export async function saveMappings(m: Mappings): Promise<void> {
  await b.storage.local.set({ [STORAGE_KEYS.mappings]: m });
}

export async function loadSettings(): Promise<Settings> {
  const { [STORAGE_KEYS.settings]: raw } = await b.storage.sync.get(STORAGE_KEYS.settings);
  if (raw && typeof raw === "object") return { ...DEFAULT_SETTINGS, ...(raw as Partial<Settings>) };
  return { ...DEFAULT_SETTINGS };
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

export type StorageChange<T> = { oldValue?: T; newValue?: T };
export type StorageChanges = Record<string, StorageChange<unknown>>;

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

export async function applyImport(payload: ExportPayload, mode: ImportMode): Promise<ImportResult> {
  if (!payload || typeof payload !== "object") return { ok: false, error: "Invalid payload" };
  if (payload.version !== EXPORT_VERSION) return { ok: false, error: `Unsupported version ${payload.version}` };
  if (!payload.mappings || typeof payload.mappings !== "object") return { ok: false, error: "Invalid mappings" };

  try {
    if (mode === "replace") {
      await saveMappings(payload.mappings);
      await saveSettings({ ...DEFAULT_SETTINGS, ...(payload.settings ?? {}) });
      await saveSiteOverrides(payload.siteOverrides ?? {});
      return { ok: true, imported: { mappings: Object.keys(payload.mappings).length, siteOverrides: Object.keys(payload.siteOverrides ?? {}).length } };
    }
    const existing = await loadMappings();
    const merged: Mappings = { ...existing, ...payload.mappings };
    await saveMappings(merged);
    const existingSettings = await loadSettings();
    await saveSettings({ ...existingSettings, ...(payload.settings ?? {}) });
    const existingOverrides = await loadSiteOverrides();
    await saveSiteOverrides({ ...existingOverrides, ...(payload.siteOverrides ?? {}) });
    return { ok: true, imported: { mappings: Object.keys(payload.mappings).length, siteOverrides: Object.keys(payload.siteOverrides ?? {}).length } };
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
    payload = JSON.parse(text);
  } catch {
    return { ok: false, error: "File is not valid JSON" };
  }
  return applyImport(payload, mode);
}