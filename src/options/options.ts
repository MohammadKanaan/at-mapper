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
import {
  DEFAULT_SETTINGS,
  type ImportMode,
  type Mappings,
  type Settings,
  type SiteOverrides,
  type Theme,
} from "../types.js";
import { stripAt } from "../shared/text.js";
import { applyTheme } from "../shared/theme.js";
import {
  filterAndSortMappings,
  createEditFields,
  getMappingEmptyMessage,
  getNewMappingError,
} from "../shared/mappings.js";
import { makeUndoToast, type UndoToast } from "../shared/undo-toast.js";

const els = {
  tabs: getAll("[data-tab]"),
  panels: getAll("[data-panel]"),
  globalEnabled: getInput("global-enabled", "checkbox"),
  trigger: getInput("trigger-char", "text"),
  triggerError: getEl("trigger-error"),
  caseSensitive: getInput("case-sensitive", "checkbox"),
  saveStatus: getEl("save-status"),
  siteInput: getInput("site-input", "text"),
  siteState: getInput("site-state", "select"),
  addSite: getEl("add-site"),
  sitesList: getEl("sites-list"),
  sitesCount: getEl("sites-count"),
  mappingSearch: getInput("mapping-search", "text"),
  mappingKey: getInput("mapping-key", "text"),
  mappingKeyError: getEl("mapping-key-error"),
  mappingVal: getInput("mapping-val", "text"),
  addMapping: getEl("add-mapping"),
  mappingsList: getEl("mappings-list"),
  mappingsCount: getEl("mappings-count"),
  undoToast: getEl("undo-toast"),
  exportBtn: getEl("export-btn"),
  importFile: getInput("import-file", "file"),
  importFileName: getEl("import-file-name"),
  importMode: getRadioGroup("import-mode"),
  importBtn: getEl("import-btn"),
  importResult: getEl("import-result"),
  version: getEl("version"),
  themeSelect: getEl("theme-select") as HTMLSelectElement,
};

let settings: Settings = { ...DEFAULT_SETTINGS };
let siteOverrides: SiteOverrides = {};
let mappings: Mappings = {};
let saveTimer: number | undefined;
let deletedMapping: { key: string; val: string } | null = null;
let editingKey: string | null = null;
let systemDarkQuery: MediaQueryList | null = null;
let undoToast: UndoToast | null = null;

function applyThemeToDoc(theme: Theme): void {
  applyTheme(document, theme, systemDarkQuery);
}

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
    if (!(el instanceof HTMLSelectElement))
      throw new Error(`#${id} is not a select`);
    return el as K extends "select" ? HTMLSelectElement : never;
  }
  if (!(el instanceof HTMLInputElement))
    throw new Error(`#${id} is not an input`);
  if (kind !== "file" && kind !== "checkbox" && kind !== "text")
    throw new Error(`Unknown kind ${kind}`);
  return el as K extends "select" ? HTMLSelectElement : HTMLInputElement;
}

function getRadioGroup(name: string): NodeListOf<HTMLInputElement> {
  return document.querySelectorAll(`input[type="radio"][name="${name}"]`);
}

function getAll(selector: string): NodeListOf<HTMLElement> {
  return document.querySelectorAll(selector);
}

async function init() {
  [mappings, settings, siteOverrides] = await Promise.all([
    loadMappings(),
    loadSettings(),
    loadSiteOverrides(),
  ]);
  undoToast = makeUndoToast({
    toastEl: els.undoToast,
    visibleClass: "visible",
    durationMs: 5000,
    onExpire: () => {
      deletedMapping = null;
    },
  });
  systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyThemeToDoc(settings.theme);
  systemDarkQuery.addEventListener("change", () => applyThemeToDoc(settings.theme));
  renderAll();
  bindGeneral();
  bindSites();
  bindMappings();
  bindData();
  bindTabs();
  onStorageChanged((changes) => {
    if (changes.settings) {
      settings = changes.settings;
      renderGeneral();
      applyThemeToDoc(settings.theme);
    }
    if (changes.siteOverrides) {
      siteOverrides = changes.siteOverrides;
      renderSites();
    }
    if (changes.mappings) {
      mappings = changes.mappings;
      if (editingKey && !(editingKey in mappings)) stopEdit();
      renderMappings();
    }
  });
  const manifest = b.runtime.getManifest();
  els.version.appendChild(
    document.createTextNode(manifest.version ?? "unknown"),
  );
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
  els.themeSelect.value = settings.theme;
  validateTrigger();
}

function setCount(el: HTMLElement, n: number) {
  el.textContent = String(n);
}

function renderEmpty(text: string): HTMLElement {
  const div = document.createElement("div");
  div.className = "list-empty";
  div.textContent = text;
  return div;
}

function renderSites() {
  const hosts = Object.keys(siteOverrides).sort();
  setCount(els.sitesCount, hosts.length);
  if (hosts.length === 0) {
    els.sitesList.replaceChildren(
      renderEmpty("No site-specific settings yet. Add one above when needed."),
    );
    return;
  }
  els.sitesList.replaceChildren(
    ...hosts.map((host) => {
      const enabled = siteOverrides[host];
      const row = document.createElement("div");
      row.className = "row";

      const main = document.createElement("div");
      main.className = "row-main";
      const name = document.createElement("span");
      name.className = "row-name";
      const code = document.createElement("code");
      code.textContent = host;
      name.appendChild(code);
      const badge = document.createElement("span");
      badge.className = `badge ${enabled ? "badge-enabled" : "badge-disabled"}`;
      badge.textContent = enabled ? "Enabled" : "Disabled";
      main.append(name, badge);

      const actions = document.createElement("div");
      actions.className = "row-actions";
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "btn btn-secondary";
      toggleBtn.dataset.action = "toggle";
      toggleBtn.dataset.host = host;
      toggleBtn.textContent = enabled ? "Disable" : "Enable";
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "btn btn-danger";
      removeBtn.dataset.action = "remove";
      removeBtn.dataset.host = host;
      removeBtn.textContent = "Remove";
      actions.append(toggleBtn, removeBtn);

      row.append(main, actions);
      return row;
    }),
  );
}

function renderMappings() {
  const entries = filterAndSortMappings(mappings, els.mappingSearch.value);
  const total = Object.keys(mappings).length;
  setCount(els.mappingsCount, total);
  if (entries.length === 0) {
    els.mappingsList.replaceChildren(
      renderEmpty(getMappingEmptyMessage(total, els.mappingSearch.value)),
    );
    return;
  }
  els.mappingsList.replaceChildren(
    ...entries.map(([key, val]) => {
      if (editingKey === key) return renderEditRow(key, val);
      const row = document.createElement("div");
      row.className = "row";

      const main = document.createElement("div");
      main.className = "row-main";
      const triggerCode = document.createElement("span");
      triggerCode.className = "row-name";
      const trigger = document.createElement("code");
      trigger.textContent = settings.trigger + key;
      triggerCode.appendChild(trigger);
      const value = document.createElement("span");
      value.className = "row-name";
      value.textContent = val;
      main.append(triggerCode, value);

      const actions = document.createElement("div");
      actions.className = "row-actions";
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-secondary";
      editBtn.dataset.action = "edit";
      editBtn.dataset.key = key;
      editBtn.textContent = "Edit";
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-danger";
      deleteBtn.dataset.action = "delete";
      deleteBtn.dataset.key = key;
      deleteBtn.textContent = "Delete";
      actions.append(editBtn, deleteBtn);

      row.append(main, actions);
      return row;
    }),
  );
}

function renderEditRow(key: string, val: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "row editing";

  const main = document.createElement("div");
  main.className = "row-main";

  const keyWrap = document.createElement("div");
  keyWrap.className = "text-field grow";

  const arrow = document.createElement("div");
  arrow.className = "arrow";
  arrow.textContent = "→";

  const valWrap = document.createElement("div");
  valWrap.className = "text-field grow";

  const fields = createEditFields({
    key,
    value: val,
    mappings,
    onSaved: async (newKey, newVal) => {
      const next: Mappings = { ...mappings };
      if (newKey !== key) delete next[key];
      next[newKey] = newVal;
      mappings = next;
      editingKey = null;
      await saveMappings(mappings);
      renderMappings();
    },
    onCancelled: () => {
      editingKey = null;
      renderMappings();
    },
  });
  fields.keyInput.setAttribute("aria-label", "Shortcut");
  fields.valInput.setAttribute("aria-label", "Replacement text");
  fields.keyInput.placeholder = "Key";
  fields.valInput.placeholder = "Replacement";
  keyWrap.appendChild(fields.keyInput);
  valWrap.appendChild(fields.valInput);

  main.append(keyWrap, arrow, valWrap);

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.className = "btn btn-success";
  saveBtn.dataset.action = "save-edit";
  saveBtn.title = "Save";
  saveBtn.setAttribute("aria-label", `Save ${settings.trigger}${key}`);
  saveBtn.textContent = "Save";
  const cancelBtn = document.createElement("button");
  cancelBtn.type = "button";
  cancelBtn.className = "btn btn-danger";
  cancelBtn.dataset.action = "cancel-edit";
  cancelBtn.title = "Cancel";
  cancelBtn.setAttribute("aria-label", `Cancel editing ${settings.trigger}${key}`);
  cancelBtn.textContent = "Cancel";
  actions.append(saveBtn, cancelBtn);

  row.append(main, actions);

  saveBtn.addEventListener("click", () => void fields.save());
  cancelBtn.addEventListener("click", fields.cancel);

  setTimeout(() => fields.focus(), 0);
  return row;
}

function startEdit(key: string) {
  editingKey = key;
  renderMappings();
}

function stopEdit() {
  editingKey = null;
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
    renderMappings();
  });
  els.caseSensitive.addEventListener("change", () => {
    settings.caseSensitive = els.caseSensitive.checked;
    save();
  });
  els.themeSelect.addEventListener("change", () => {
    settings = { ...settings, theme: els.themeSelect.value as Theme };
    applyThemeToDoc(settings.theme);
    save();
  });
}

function validateTrigger(): boolean {
  const value = els.trigger.value;
  const ok = value.length === 1 && !/\s/.test(value);
  els.trigger.classList.toggle("invalid", !ok);
  els.trigger.setAttribute("aria-invalid", String(!ok));
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
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
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
    const error = getNewMappingError(mappings, key, val, settings.trigger);
    if (error) {
      els.mappingKey.classList.add("invalid");
      els.mappingKey.setAttribute("aria-invalid", "true");
      els.mappingKeyError.textContent = error;
      return;
    }
    els.mappingKey.classList.remove("invalid");
    els.mappingKey.removeAttribute("aria-invalid");
    els.mappingKeyError.textContent = "";
    mappings = { ...mappings, [key]: val };
    await saveMappings(mappings);
    els.mappingKey.value = "";
    els.mappingVal.value = "";
    renderMappings();
  };
  els.addMapping.addEventListener("click", add);
  const clearMappingError = () => {
    els.mappingKey.classList.remove("invalid");
    els.mappingKey.removeAttribute("aria-invalid");
    els.mappingKeyError.textContent = "";
  };
  els.mappingKey.addEventListener("input", clearMappingError);
  els.mappingVal.addEventListener("input", clearMappingError);
  els.mappingKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") els.mappingVal.focus();
  });
  els.mappingVal.addEventListener("keydown", (e) => {
    if (e.key === "Enter") add();
  });
  els.mappingsList.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>(
      "[data-action]",
    );
    if (!btn) return;
    const key = btn.dataset.key;
    if (!key) return;
    if (btn.dataset.action === "edit") {
      startEdit(key);
    } else if (btn.dataset.action === "delete") {
      deleteMapping(key);
    }
  });
}

function deleteMapping(key: string) {
  const val = mappings[key];
  if (val === undefined) return;
  const next = { ...mappings };
  delete next[key];
  mappings = next;
  deletedMapping = { key, val };
  if (editingKey === key) stopEdit();
  saveMappings(mappings).then(() => {
    renderMappings();
    showUndoToast();
  });
}

function showUndoToast() {
  if (!deletedMapping || !undoToast) return;
  els.undoToast.replaceChildren();

  const msg = document.createElement("span");
  msg.textContent = `Deleted ${settings.trigger}${deletedMapping.key}`;
  const undoBtn = document.createElement("button");
  undoBtn.type = "button";
  undoBtn.className = "btn btn-primary";
  undoBtn.textContent = "Undo";
  undoBtn.addEventListener("click", () => {
    if (!deletedMapping) return;
    mappings = { ...mappings, [deletedMapping.key]: deletedMapping.val };
    deletedMapping = null;
    saveMappings(mappings).then(renderMappings);
    undoToast?.hide();
  });
  els.undoToast.append(msg, undoBtn);

  undoToast.show();
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

function bindTabs() {
  const tabs = Array.from(els.tabs);
  const panels = Array.from(els.panels);

  const setActive = (target: HTMLElement) => {
    const tabId = target.dataset.tab;
    if (!tabId) return;

    for (const tab of tabs) {
      const active = tab.dataset.tab === tabId;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) {
      const active = panel.dataset.panel === tabId;
      panel.classList.toggle("active", active);
      if (active) {
        panel.removeAttribute("hidden");
      } else {
        panel.setAttribute("hidden", "");
      }
    }
  };

  for (const tab of tabs) {
    tab.addEventListener("click", () => setActive(tab));
    tab.addEventListener("keydown", (e) => {
      const idx = tabs.indexOf(tab);
      let nextIdx = -1;
      if (e.key === "ArrowRight") nextIdx = (idx + 1) % tabs.length;
      if (e.key === "ArrowLeft")
        nextIdx = (idx - 1 + tabs.length) % tabs.length;
      if (nextIdx < 0) return;
      e.preventDefault();
      const next = tabs[nextIdx];
      if (next) {
        setActive(next);
        next.focus();
      }
    });
  }
}

function flashSaved() {
  els.saveStatus.textContent = "Saved ✓";
  els.saveStatus.classList.add("visible");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    els.saveStatus.classList.remove("visible");
    setTimeout(() => {
      if (!els.saveStatus.classList.contains("visible"))
        els.saveStatus.textContent = "";
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

document.addEventListener("DOMContentLoaded", () => {
  void init();
});
