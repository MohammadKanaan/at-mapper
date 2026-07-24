import { b } from "../browser.js";
import { currentHostname, isSiteEnabled } from "../host.js";
import {
  loadMappings,
  loadSettings,
  loadSiteOverrides,
  saveSiteOverrides,
  exportToFile,
  importFromFile,
  onStorageChanged,
} from "../storage.js";
import { DEFAULT_SETTINGS, type Mappings, type Settings, type SiteOverrides } from "../types.js";

const hostBadge = document.getElementById("hostBadge") as HTMLSpanElement;
const siteToggleInput = document.getElementById("siteToggleInput") as HTMLInputElement;
const siteToggleLabel = document.getElementById("siteToggleLabel") as HTMLSpanElement;
const siteStatus = document.getElementById("siteStatus") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const mappingsList = document.getElementById("mappingsList") as HTMLUListElement;
const emptyState = document.getElementById("emptyState") as HTMLDivElement;
const exportBtn = document.getElementById("exportBtn") as HTMLButtonElement;
const importBtn = document.getElementById("importBtn") as HTMLButtonElement;
const importFile = document.getElementById("importFile") as HTMLInputElement;
const optionsBtn = document.getElementById("optionsBtn") as HTMLButtonElement;
const footerOptions = document.getElementById("footerOptions") as HTMLButtonElement;
const statusMsg = document.getElementById("statusMsg") as HTMLDivElement;

let settings: Settings | null = null;
let siteOverrides: SiteOverrides = {};
let mappings: Mappings = {};
let hostname = "";
let statusTimeout: number | null = null;

function truncateHost(host: string): string {
  return host.length > 28 ? `${host.slice(0, 25)}…` : host;
}

function getCurrentTabHostname(): Promise<string> {
  return new Promise((resolve) => {
    b.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      const url = tab?.url;
      if (!url) {
        resolve("");
        return;
      }
      try {
        resolve(new URL(url).hostname || "");
      } catch {
        resolve("");
      }
    });
  });
}

function renderToggle(): void {
  if (!hostname) {
    hostBadge.textContent = "";
    siteToggleLabel.textContent = "Not applicable on this page";
    siteStatus.textContent = "";
    siteToggleInput.checked = false;
    siteToggleInput.disabled = true;
    return;
  }

  hostBadge.textContent = truncateHost(hostname);
  const enabled = isSiteEnabled(settings ?? DEFAULT_SETTINGS, siteOverrides, hostname);
  siteToggleInput.checked = enabled;
  siteToggleInput.disabled = false;
  siteToggleLabel.textContent = `Enabled on ${hostname}`;

  const rawOverride = siteOverrides[hostname];
  let statusText: string;
  if (rawOverride === true) statusText = "Enabled for this site";
  else if (rawOverride === false) statusText = "Disabled for this site";
  else if (settings?.globalEnabledByDefault) statusText = "Globally enabled";
  else statusText = "Globally disabled";
  siteStatus.textContent = statusText;
}

function renderMappings(): void {
  const query = searchInput.value.trim().toLowerCase();
  const entries = Object.entries(mappings).filter(([key, value]) => {
    if (!query) return true;
    return key.toLowerCase().includes(query) || value.toLowerCase().includes(query);
  });

  mappingsList.innerHTML = "";

  if (entries.length === 0) {
    emptyState.classList.add("empty--visible");
    return;
  }
  emptyState.classList.remove("empty--visible");

  for (const [key, value] of entries) {
    const li = document.createElement("li");
    li.className = "mapping";

    const keySpan = document.createElement("span");
    keySpan.className = "mapping__key";
    keySpan.textContent = `@${key}`;

    const sep = document.createElement("span");
    sep.className = "mapping__sep";
    sep.textContent = "→";

    const valSpan = document.createElement("span");
    valSpan.className = "mapping__val";
    valSpan.textContent = value;
    valSpan.title = value;

    li.append(keySpan, sep, valSpan);
    mappingsList.appendChild(li);
  }
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
}

function showStatus(text: string, isError: boolean): void {
  if (statusTimeout !== null) {
    window.clearTimeout(statusTimeout);
    statusTimeout = null;
  }
  statusMsg.textContent = text;
  statusMsg.className = `status status--visible ${isError ? "status--error" : "status--success"}`;
  statusTimeout = window.setTimeout(() => {
    statusMsg.classList.remove("status--visible", "status--success", "status--error");
  }, 2000);
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
    showStatus("Exported!", false);
  } catch (e) {
    showStatus(e instanceof Error ? e.message : "Export failed", true);
  }
}

async function handleImport(file: File | null): Promise<void> {
  if (!file) return;
  const result = await importFromFile(file, "merge");
  if (result.ok) {
    showStatus(`Imported ${result.imported?.mappings ?? 0} mappings.`, false);
  } else {
    showStatus(result.error ?? "Import failed", true);
  }
}

function openOptions(): void {
  b.runtime.openOptionsPage();
}

async function init(): Promise<void> {
  await initData();
  renderToggle();
  renderMappings();

  siteToggleInput.addEventListener("change", handleToggle);
  searchInput.addEventListener("input", renderMappings);
  exportBtn.addEventListener("click", handleExport);
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", () => handleImport(importFile.files?.[0] ?? null));
  optionsBtn.addEventListener("click", openOptions);
  footerOptions.addEventListener("click", openOptions);

  onStorageChanged((changes) => {
    if (changes.mappings !== undefined) mappings = changes.mappings;
    if (changes.siteOverrides !== undefined) siteOverrides = changes.siteOverrides;
    if (changes.settings !== undefined) settings = changes.settings;
    renderToggle();
    renderMappings();
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  void init();
}
