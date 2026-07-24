import { b } from "../browser.js";

import {
  loadMappings,
  loadSettings,
  loadSiteOverrides,
  onStorageChanged,
  saveMappings,
  saveSettings,
  saveSiteOverrides,
  exportToFile,
  importFromFile,
} from "../storage.js";
import { DEFAULT_SETTINGS, type ImportMode, type Mappings, type Settings, type SiteOverrides } from "../types.js";

const els = {
  globalEnabled: getInput("global-enabled", "checkbox"),
  trigger: getInput("trigger-char", "text"),
  triggerError: getEl("trigger-error"),
  caseSensitive: getInput("case-sensitive", "checkbox"),
  fabEnabled: getInput("fab-enabled", "checkbox"),
  saveStatus: getEl("save-status"),
  siteInput: getInput("site-input", "text"),
  siteState: getInput("site-state", "select"),
  addSite: getEl("add-site"),
  sitesList: getEl("sites-list"),
  mappingSearch: getInput("mapping-search", "text"),
  mappingKey: getInput("mapping-key", "text"),
  mappingVal: getInput("mapping-val", "text"),
  addMapping: getEl("add-mapping"),
  mappingsList: getEl("mappings-list"),
  exportBtn: getEl("export-btn"),
  importFile: getInput("import-file", "file"),
  importFileName: getEl("import-file-name"),
  importMode: getRadioGroup("import-mode"),
  importBtn: getEl("import-btn"),
  importResult: getEl("import-result"),
  version: getEl("version"),
  userscriptLink: getEl("userscript-link"),
};

let settings: Settings = { ...DEFAULT_SETTINGS };
let siteOverrides: SiteOverrides = {};
let mappings: Mappings = {};
let saveTimer: number | undefined;

function getEl(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

function getInput<K extends "text" | "checkbox" | "select" | "file">(
  id: string,
  kind: K,
): K extends "select" ? HTMLSelectElement : HTMLInputElement {
  const el = getEl(id);
  if (kind === "select") {
    if (!(el instanceof HTMLSelectElement)) throw new Error(`#${id} is not a select`);
    return el as K extends "select" ? HTMLSelectElement : never;
  }
  if (!(el instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  if (kind !== "file" && kind !== "checkbox" && kind !== "text") throw new Error(`Unknown kind ${kind}`);
  return el as K extends "select" ? HTMLSelectElement : HTMLInputElement;
}

function getRadioGroup(name: string): NodeListOf<HTMLInputElement> {
  return document.querySelectorAll(`input[type="radio"][name="${name}"]`);
}

async function init() {
  [mappings, settings, siteOverrides] = await Promise.all([
    loadMappings(),
    loadSettings(),
    loadSiteOverrides(),
  ]);
  renderAll();
  bindGeneral();
  bindSites();
  bindMappings();
  bindData();
  onStorageChanged((changes) => {
    if (changes.settings) {
      settings = changes.settings;
      renderGeneral();
    }
    if (changes.siteOverrides) {
      siteOverrides = changes.siteOverrides;
      renderSites();
    }
    if (changes.mappings) {
      mappings = changes.mappings;
      renderMappings();
    }
  });
  const manifest = b.runtime.getManifest();
  els.version.appendChild(document.createTextNode(manifest.version ?? "unknown"));
  els.userscriptLink.addEventListener("click", (e) => {
    e.preventDefault();
    b.tabs.create({ url: "https://github.com/usememos/memos" });
  });
}

function renderAll() {
  renderGeneral();
  renderSites();
  renderMappings();
}

function renderGeneral() {
  els.globalEnabled.checked = settings.globalEnabledByDefault;
  els.trigger.value = settings.trigger;
  els.caseSensitive.checked = settings.caseSensitive;
  els.fabEnabled.checked = settings.fabEnabled;
  validateTrigger();
}

function renderSites() {
  const hosts = Object.keys(siteOverrides).sort();
  if (hosts.length === 0) {
    els.sitesList.innerHTML = "<div class=\"list-empty\">No overrides yet.</div>";
    return;
  }
  els.sitesList.replaceChildren(
    ...hosts.map((host) => {
      const enabled = siteOverrides[host];
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-main">
          <span class="row-name"><code>${escapeHtml(host)}</code></span>
          <span class="badge ${enabled ? "badge-enabled" : "badge-disabled"}">${enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-secondary" data-action="toggle" data-host="${escapeHtml(host)}">Toggle</button>
          <button type="button" class="btn btn-danger" data-action="remove" data-host="${escapeHtml(host)}">✕</button>
        </div>
      `;
      return row;
    }),
  );
}

function renderMappings() {
  const term = els.mappingSearch.value.trim().toLowerCase();
  const entries = Object.entries(mappings)
    .filter(([key, val]) => !term || key.toLowerCase().includes(term) || val.toLowerCase().includes(term))
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) {
    els.mappingsList.innerHTML = `<div class="list-empty">${term ? "No matches." : "No mappings yet."}</div>`;
    return;
  }
  els.mappingsList.replaceChildren(
    ...entries.map(([key, val]) => {
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <div class="row-main">
          <span class="row-name"><code>${escapeHtml(settings.trigger + key)}</code></span>
          <span class="row-name">${escapeHtml(val)}</span>
        </div>
        <div class="row-actions">
          <button type="button" class="btn btn-danger" data-action="delete" data-key="${escapeHtml(key)}">✕</button>
        </div>
      `;
      return row;
    }),
  );
}

function bindGeneral() {
  const save = debounceSave(async () => {
    await saveSettings(settings);
    flashSaved();
  });
  els.globalEnabled.addEventListener("change", () => {
    settings.globalEnabledByDefault = els.globalEnabled.checked;
    save();
  });
  els.trigger.addEventListener("input", () => {
    if (!validateTrigger()) return;
    settings.trigger = els.trigger.value;
    save();
  });
  els.caseSensitive.addEventListener("change", () => {
    settings.caseSensitive = els.caseSensitive.checked;
    save();
  });
  els.fabEnabled.addEventListener("change", () => {
    settings.fabEnabled = els.fabEnabled.checked;
    save();
  });
}

function validateTrigger(): boolean {
  const value = els.trigger.value;
  const ok = value.length === 1 && !/\s/.test(value);
  els.trigger.classList.toggle("invalid", !ok);
  return ok;
}

function bindSites() {
  const add = async () => {
    const host = normalizeHostname(els.siteInput.value);
    if (!host || siteOverrides[host] !== undefined) return;
    const enabled = els.siteState.value === "enabled";
    siteOverrides = { ...siteOverrides, [host]: enabled };
    await saveSiteOverrides(siteOverrides);
    els.siteInput.value = "";
    renderSites();
  };
  els.addSite.addEventListener("click", add);
  els.siteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });
  els.sitesList.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action]");
    if (!btn) return;
    const host = btn.dataset.host;
    if (!host) return;
    if (btn.dataset.action === "remove") {
      const next = { ...siteOverrides };
      delete next[host];
      siteOverrides = next;
      saveSiteOverrides(siteOverrides).then(renderSites);
    } else if (btn.dataset.action === "toggle") {
      siteOverrides = { ...siteOverrides, [host]: !siteOverrides[host] };
      saveSiteOverrides(siteOverrides).then(renderSites);
    }
  });
}

function bindMappings() {
  els.mappingSearch.addEventListener("input", renderMappings);
  const add = async () => {
    const key = stripAt(els.mappingKey.value).trim();
    const val = els.mappingVal.value.trim();
    if (!key || !val || mappings[key] === val) return;
    mappings = { ...mappings, [key]: val };
    await saveMappings(mappings);
    els.mappingKey.value = "";
    els.mappingVal.value = "";
    renderMappings();
  };
  els.addMapping.addEventListener("click", add);
  els.mappingKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.mappingVal.focus();
  });
  els.mappingVal.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });
  els.mappingsList.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-action=\"delete\"]");
    if (!btn) return;
    const key = btn.dataset.key;
    if (!key) return;
    const next = { ...mappings };
    delete next[key];
    mappings = next;
    saveMappings(mappings).then(renderMappings);
  });
}

function bindData() {
  els.exportBtn.addEventListener("click", () => exportToFile());
  els.importFile.addEventListener("change", () => {
    const file = els.importFile.files?.[0];
    els.importFileName.textContent = file ? file.name : "Choose file";
  });
  els.importBtn.addEventListener("click", async () => {
    const file = els.importFile.files?.[0];
    if (!file) return;
    const mode = getSelectedImportMode();
    const result = await importFromFile(file, mode);
    if (result.ok) {
      showImportResult(
        `Imported ${result.imported?.mappings ?? 0} mappings and ${result.imported?.siteOverrides ?? 0} site overrides.`,
        true,
      );
      [mappings, settings, siteOverrides] = await Promise.all([
        loadMappings(),
        loadSettings(),
        loadSiteOverrides(),
      ]);
      renderAll();
    } else {
      showImportResult(result.error ?? "Import failed.", false);
    }
  });
}

function getSelectedImportMode(): ImportMode {
  let selected: ImportMode = "merge";
  els.importMode.forEach((radio) => {
    if (radio.checked) selected = radio.value as ImportMode;
  });
  return selected;
}

function showImportResult(message: string, success: boolean) {
  els.importResult.textContent = message;
  els.importResult.className = `import-result ${success ? "success" : "error"}`;
}

function flashSaved() {
  els.saveStatus.textContent = "Saved ✓";
  els.saveStatus.classList.add("visible");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    els.saveStatus.classList.remove("visible");
    setTimeout(() => {
      if (!els.saveStatus.classList.contains("visible")) els.saveStatus.textContent = "";
    }, 300);
  }, 1000);
}

function debounceSave(fn: () => Promise<void>): () => void {
  let timer: number | undefined;
  return () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      void fn();
    }, 250);
  };
}

function normalizeHostname(value: string): string {
  let host = value.trim().toLowerCase();
  try {
    if (!/^https?:\/\//i.test(host)) host = `https://${host}`;
    const url = new URL(host);
    host = url.hostname;
  } catch {
    host = host.replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  }
  return host.replace(/^www\./, "");
}

function stripAt(value: string): string {
  return value.replace(/^@+/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", () => {
  void init();
});
