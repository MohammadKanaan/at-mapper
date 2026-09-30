import { TOAST_DURATION_MS } from "../constants.js";
import { b } from "../browser.js";
import { isSiteEnabled } from "../host.js";
import {
  loadMappings,
  loadSettings,
  loadSiteOverrides,
  saveMappings,
  saveSiteOverrides,
  saveSettings,
  exportToFile,
  importFromFile,
  onStorageChanged,
} from "../storage.js";
import { DEFAULT_SETTINGS, type Mappings, type Settings, type SiteOverrides, type Theme } from "../types.js";
import { stripAt } from "../shared/text.js";
import { applyTheme, themeLabel, themeName } from "../shared/theme.js";
import {
  filterAndSortMappings,
  createEditFields,
  formatMappingShortcut,
  getMappingEmptyMessage,
  getNewMappingError,
} from "../shared/mappings.js";
import { makeUndoToast, type UndoToast } from "../shared/undo-toast.js";
import { createUiButton } from "../ui/index.js";

const hostBadge = document.getElementById("hostBadge") as HTMLSpanElement;
const siteToggleInput = document.getElementById("siteToggleInput") as HTMLInputElement;
const siteToggleLabel = document.getElementById("siteToggleLabel") as HTMLSpanElement;
const siteStatus = document.getElementById("siteStatus") as HTMLSpanElement;
const newKey = document.getElementById("newKey") as HTMLInputElement;
const newVal = document.getElementById("newVal") as HTMLInputElement;
const addBtn = document.getElementById("addBtn") as HTMLButtonElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const mappingCount = document.getElementById("mappingCount") as HTMLSpanElement;
const mappingsList = document.getElementById("mappingsList") as HTMLUListElement;
const emptyState = document.getElementById("emptyState") as HTMLDivElement;
const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
const importBtn = document.getElementById("importBtn") as HTMLButtonElement;
const importFile = document.getElementById("importFile") as HTMLInputElement;
const optionsBtn = document.getElementById("optionsBtn") as HTMLButtonElement;
const statusMsg = document.getElementById("statusMsg") as HTMLDivElement;
const undoToast = document.getElementById("undoToast") as HTMLDivElement;
const undoText = document.getElementById("undoText") as HTMLSpanElement;
const undoBtn = document.getElementById("undoBtn") as HTMLButtonElement;
const themeToggle = document.getElementById("themeToggle") as HTMLButtonElement;

let settings: Settings | null = null;
let siteOverrides: SiteOverrides = {};
let mappings: Mappings = {};
let hostname = "";
let statusTimeout: number | null = null;
let lastDeleted: { key: string; value: string } | null = null;
let editingKey: string | null = null;
let systemDarkQuery: MediaQueryList | null = null;
let undoToastCtrl: UndoToast | null = null;

function applyThemeToDoc(theme: Theme): void {
  const resolved = applyTheme(document, theme, systemDarkQuery);
  updateThemeToggle(theme, resolved);
}

function updateThemeToggle(theme: Theme, resolved: "light" | "dark"): void {
  themeToggle.textContent = themeName(theme);
  themeToggle.title = themeLabel(theme, resolved);
  themeToggle.setAttribute("aria-label", themeLabel(theme, resolved));
}

function cycleTheme(): void {
  if (!settings) return;
  const order: Theme[] = ["auto", "light", "dark"];
  const current = settings.theme;
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  settings = { ...settings, theme: next };
  saveSettings(settings).catch((e) => console.error("[@-Mapper] could not save theme", e));
  applyThemeToDoc(next);
}

function truncateHost(host: string): string {
  return host.length > 28 ? `${host.slice(0, 25)}…` : host;
}

async function getCurrentTabHostname(): Promise<string> {
  try {
    const [tab] = await b.tabs.query({ active: true, currentWindow: true });
    return tab?.url ? new URL(tab.url).hostname : "";
  } catch {
    return "";
  }
}

function getFilteredEntries(): [string, string][] {
  return filterAndSortMappings(mappings, searchInput.value);
}

function mappingShortcut(key: string): string {
  return formatMappingShortcut(settings?.trigger ?? DEFAULT_SETTINGS.trigger, key);
}

function renderToggle(): void {
  if (!hostname) {
    hostBadge.textContent = "";
    siteToggleLabel.textContent = "Unavailable on this page";
    siteStatus.textContent = "Open a regular website to change its setting.";
    siteToggleInput.checked = false;
    siteToggleInput.disabled = true;
    return;
  }

  hostBadge.textContent = truncateHost(hostname);
  hostBadge.title = hostname;
  const enabled = isSiteEnabled(settings ?? DEFAULT_SETTINGS, siteOverrides, hostname);
  siteToggleInput.checked = enabled;
  siteToggleInput.disabled = false;
  siteToggleLabel.textContent = "Use on this site";

  const rawOverride = siteOverrides[hostname];
  let statusText: string;
  if (rawOverride === true) statusText = "Custom setting: enabled";
  else if (rawOverride === false) statusText = "Custom setting: disabled";
  else if (settings?.globalEnabledByDefault) statusText = "Following global setting: enabled";
  else statusText = "Following global setting: disabled";
  siteStatus.textContent = statusText;
}

function updateCount(filtered: number, total: number): void {
  const query = searchInput.value.trim();
  if (query && filtered !== total) {
    mappingCount.textContent = `${filtered} of ${total}`;
  } else {
    mappingCount.textContent = `${total} mapping${total === 1 ? "" : "s"}`;
  }
}

function createDisplayRow(key: string, value: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "ui-list-row ui-list-row--compact mapping";
  li.dataset.key = key;

  const main = document.createElement("div");
  main.className = "ui-list-row__main mapping__main";

  const keySpan = document.createElement("span");
  keySpan.className = "mapping__key";
  keySpan.textContent = mappingShortcut(key);

  const sep = document.createElement("span");
  sep.className = "mapping__sep";
  sep.textContent = "→";
  sep.setAttribute("aria-hidden", "true");

  const valSpan = document.createElement("span");
  valSpan.className = "mapping__val";
  valSpan.textContent = value;
  valSpan.title = value;

  main.append(keySpan, sep, valSpan);

  const actions = document.createElement("div");
  actions.className = "ui-list-row__actions mapping__actions";

  const editBtn = createUiButton({
    label: `Edit ${mappingShortcut(key)}`,
    variant: "icon",
    density: "compact",
    icon: "edit",
    title: `Edit ${mappingShortcut(key)}`,
  });
  editBtn.addEventListener("click", () => startEdit(key));

  const deleteBtn = createUiButton({
    label: `Delete ${mappingShortcut(key)}`,
    variant: "icon",
    density: "compact",
    icon: "delete",
    title: `Delete ${mappingShortcut(key)}`,
    className: "ui-button--icon-danger",
  });
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    run(deleteMapping(key));
  });

  actions.append(editBtn, deleteBtn);
  li.append(main, actions);
  return li;
}

function createEditRow(key: string, value: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "ui-list-row ui-list-row--compact mapping mapping--editing";
  li.dataset.key = key;
  li.dataset.editing = "true";

  const row = document.createElement("div");
  row.className = "edit-row";

  const keyField = document.createElement("div");
  keyField.className = "ui-field";

  const arrow = document.createElement("span");
  arrow.className = "arrow";
  arrow.textContent = "→";
  arrow.setAttribute("aria-hidden", "true");

  const valField = document.createElement("div");
  valField.className = "ui-field";

  const fields = createEditFields({
    key,
    value,
    mappings,
    onSaved: async (newKeyName, newValue) => {
      const next: Mappings = { ...mappings };
      if (newKeyName !== key) delete next[key];
      next[newKeyName] = newValue;
      mappings = next;
      await saveMappings(mappings);
      cancelEdit();
    },
    onCancelled: cancelEdit,
  });
  fields.keyInput.setAttribute("aria-label", "Shortcut");
  fields.valInput.setAttribute("aria-label", "Replacement text");
  fields.keyInput.className = "ui-input ui-input--compact";
  fields.valInput.className = "ui-input ui-input--compact";
  keyField.appendChild(fields.keyInput);
  valField.appendChild(fields.valInput);

  const actions = document.createElement("div");
  actions.className = "ui-list-row__actions mapping__actions";

  const saveBtn = createUiButton({
    label: `Save ${mappingShortcut(key)}`,
    variant: "icon",
    density: "compact",
    icon: "save",
    title: `Save ${mappingShortcut(key)}`,
  });

  const cancelBtn = createUiButton({
    label: `Cancel editing ${mappingShortcut(key)}`,
    variant: "icon",
    density: "compact",
    icon: "cancel",
    title: `Cancel editing ${mappingShortcut(key)}`,
    className: "ui-button--icon-danger",
  });

  actions.append(saveBtn, cancelBtn);
  row.append(keyField, arrow, valField, actions);
  li.appendChild(row);

  saveBtn.addEventListener("click", () => run(fields.save()));
  cancelBtn.addEventListener("click", fields.cancel);

  requestAnimationFrame(() => fields.focus());

  return li;
}

function renderMappings(): void {
  const entries = getFilteredEntries();
  const total = Object.keys(mappings).length;
  updateCount(entries.length, total);

  mappingsList.replaceChildren();

  if (entries.length === 0) {
    emptyState.textContent = getMappingEmptyMessage(total, searchInput.value);
    emptyState.classList.add("empty--visible");
    return;
  }
  emptyState.classList.remove("empty--visible");

  for (const [key, value] of entries) {
    const row = editingKey === key ? createEditRow(key, value) : createDisplayRow(key, value);
    mappingsList.appendChild(row);
  }
}

function startEdit(key: string): void {
  if (editingKey === key) return;
  editingKey = key;
  renderMappings();
}

function cancelEdit(): void {
  editingKey = null;
  renderMappings();
}

async function addMapping(): Promise<void> {
  const key = stripAt(newKey.value);
  const val = newVal.value.trim();
  const trigger = settings?.trigger ?? DEFAULT_SETTINGS.trigger;
  const error = getNewMappingError(mappings, key, val, trigger);
  if (error) {
    newKey.setAttribute("aria-invalid", "true");
    showStatus(error, true);
    return;
  }
  newKey.removeAttribute("aria-invalid");
  mappings = { ...mappings, [key]: val };
  await saveMappings(mappings);
  newKey.value = "";
  newVal.value = "";
  newKey.focus();
  renderMappings();
}

async function deleteMapping(key: string): Promise<void> {
  const value = mappings[key];
  if (value === undefined) return;
  const next: Mappings = { ...mappings };
  delete next[key];
  mappings = next;
  await saveMappings(mappings);
  if (editingKey === key) editingKey = null;
  showUndo(key, value);
  renderMappings();
}

function showUndo(key: string, value: string): void {
  lastDeleted = { key, value };
  undoText.textContent = `Deleted ${mappingShortcut(key)}`;
  undoToastCtrl?.show();
}

function hideUndo(): void {
  undoToastCtrl?.hide();
  lastDeleted = null;
}

async function undoDelete(): Promise<void> {
  if (!lastDeleted) return;
  const { key, value } = lastDeleted;
  if (mappings[key] !== undefined) {
    hideUndo();
    return;
  }
  mappings = { ...mappings, [key]: value };
  await saveMappings(mappings);
  hideUndo();
  renderMappings();
}

function showStatus(text: string, isError: boolean): void {
  if (statusTimeout !== null) {
    window.clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  statusMsg.textContent = text;
  statusMsg.className = `ui-notice status status--visible ${isError ? "ui-notice--danger" : "ui-notice--success"}`;
  statusTimeout = window.setTimeout(() => {
    statusMsg.classList.remove("status--visible", "ui-notice--success", "ui-notice--danger");
  }, 2000);
}

/** Run a fire-and-forget task from an event handler, surfacing failures in the status line. */
function run(task: Promise<unknown>): void {
  task.catch((e: unknown) => {
    console.error("[@-Mapper] action failed", e);
    showStatus(e instanceof Error ? e.message : "Something went wrong", true);
  });
}

async function handleToggle(): Promise<void> {
  if (!hostname) return;
  const currentlyEnabled = isSiteEnabled(settings ?? DEFAULT_SETTINGS, siteOverrides, hostname);
  const nextOverrides: SiteOverrides = { ...siteOverrides, [hostname]: !currentlyEnabled };
  siteOverrides = nextOverrides;
  await saveSiteOverrides(siteOverrides);
  renderToggle();
}

async function handleExport(): Promise<void> {
  try {
    await exportToFile();
    showStatus("Export complete.", false);
  } catch (e) {
    showStatus(e instanceof Error ? e.message : "Export failed", true);
  }
}

async function handleImport(file: File | null): Promise<void> {
  if (!file) return;
  try {
    const result = await importFromFile(file, "merge");
    if (result.ok) {
      showStatus(`Imported ${result.imported?.mappings ?? 0} mappings.`, false);
      mappings = await loadMappings();
      renderMappings();
    } else {
      showStatus(result.error ?? "Import failed", true);
    }
  } catch (e) {
    showStatus(e instanceof Error ? e.message : "Import failed", true);
  } finally {
    importFile.value = "";
  }
}

function openOptions(): void {
  b.runtime.openOptionsPage();
}

async function initData(): Promise<void> {
  const [loadedSettings, loadedOverrides, loadedMappings] = await Promise.all([
    loadSettings(),
    loadSiteOverrides(),
    loadMappings(),
  ]);
  settings = loadedSettings;
  siteOverrides = loadedOverrides;
  mappings = loadedMappings;
  hostname = await getCurrentTabHostname();
  newKey.placeholder = mappingShortcut("word");
}

async function init(): Promise<void> {
  await initData();
  systemDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  applyThemeToDoc(settings?.theme ?? DEFAULT_SETTINGS.theme);
  systemDarkQuery.addEventListener("change", () => {
    if (settings) applyThemeToDoc(settings.theme);
  });
  undoToastCtrl = makeUndoToast({
    toastEl: undoToast,
    visibleClass: "toast--visible",
    durationMs: TOAST_DURATION_MS,
    onExpire: () => {
      lastDeleted = null;
    },
  });
  renderToggle();
  renderMappings();

  siteToggleInput.addEventListener("change", () => run(handleToggle()));
  addBtn.addEventListener("click", () => run(addMapping()));
  themeToggle.addEventListener("click", cycleTheme);
  newKey.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      newVal.focus();
    }
  });
  newVal.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run(addMapping());
    }
  });
  const clearAddError = () => {
    newKey.value = stripAt(newKey.value);
    newKey.removeAttribute("aria-invalid");
  };
  newKey.addEventListener("input", clearAddError);
  newVal.addEventListener("input", clearAddError);
  searchInput.addEventListener("input", renderMappings);
  exportBtn.addEventListener("click", handleExport);
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => run(handleImport(importFile.files?.[0] ?? null)));
  optionsBtn.addEventListener("click", openOptions);
  undoBtn.addEventListener("click", () => run(undoDelete()));

  onStorageChanged((changes) => {
    if (changes.mappings !== undefined) mappings = changes.mappings;
    if (changes.siteOverrides !== undefined) siteOverrides = changes.siteOverrides;
    if (changes.settings !== undefined) {
      settings = changes.settings;
      applyThemeToDoc(settings.theme);
      newKey.placeholder = mappingShortcut("word");
    }
    renderToggle();
    renderMappings();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init().catch((e) => console.error("[@-Mapper] popup init failed", e));
}
