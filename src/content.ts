import { b } from "./browser.js";
import {
  loadMappings,
  loadSettings,
  loadSiteOverrides,
  saveMappings,
  saveSettings,
  onStorageChanged,
} from "./storage.js";
import { currentHostname, isSiteEnabled } from "./host.js";
import { findEditors, observeEditors } from "./editor.js";
import { createAutocomplete } from "./autocomplete.js";
import { createPanel, showToast } from "./panel.js";
import type { EditorTarget, Mappings, Settings, SiteOverrides } from "./types.js";

const SCRIPT_NAME = "@-Mapper";

let mappings: Mappings = {};
let settings: Settings;
let overrides: SiteOverrides = {};
const attached = new Map<HTMLElement, EditorTarget>();
let detachObserver: () => void = () => {};
let active = false;

const autocomplete = createAutocomplete({
  getMappings: () => mappings,
  getSettings: () => settings,
  addMapping: (key, val) => {
    mappings[key] = val;
    void saveMappings(mappings).catch(() => showToast(`${SCRIPT_NAME}: could not save`));
  },
  openPanel: () => panel.openPanel(),
});

const panel = createPanel({
  getMappings: () => mappings,
  getSettings: () => settings,
  updateSetting: (key, value) => {
    (settings as unknown as Record<string, unknown>)[key] = value;
    void saveSettings(settings).catch(() => showToast(`${SCRIPT_NAME}: could not save`));
  },
  addMapping: (key, val) => {
    mappings[key] = val;
    void saveMappings(mappings).catch(() => showToast(`${SCRIPT_NAME}: could not save`));
  },
  deleteMapping: (key) => {
    delete mappings[key];
    void saveMappings(mappings).catch(() => showToast(`${SCRIPT_NAME}: could not save`));
  },
});

function kindOf(el: HTMLElement): EditorTarget["kind"] {
  return el.tagName === "TEXTAREA" ? "textarea" : "contenteditable";
}

function syncEditors(): void {
  if (!active) return;
  const targets = findEditors();
  const next = new Set(targets.map((t) => t.el));

  for (const [el] of attached) {
    if (!next.has(el)) {
      autocomplete.detach(attached.get(el)!);
      attached.delete(el);
    }
  }
  for (const t of targets) {
    if (!attached.has(t.el)) {
      autocomplete.attach(t);
      attached.set(t.el, t);
    }
  }

  if (settings.fabEnabled !== false) panel.ensureFAB();
  else panel.removeFAB();
}

function activate(): void {
  if (active) return;
  active = true;
  detachObserver = observeEditors(syncEditors);
  window.addEventListener("scroll", autocomplete.hidePopup, true);
  window.addEventListener("resize", autocomplete.hidePopup);
  syncEditors();
}

function deactivate(): void {
  if (!active) return;
  active = false;
  detachObserver();
  detachObserver = () => {};
  window.removeEventListener("scroll", autocomplete.hidePopup, true);
  window.removeEventListener("resize", autocomplete.hidePopup);
  for (const [el] of attached) {
    autocomplete.detach(attached.get(el)!);
  }
  attached.clear();
  autocomplete.hidePopup();
  panel.closePanel();
  panel.removeFAB();
}

function reevaluate(): void {
  const host = currentHostname();
  if (isSiteEnabled(settings, overrides, host)) activate();
  else deactivate();
}

async function init(): Promise<void> {
  [mappings, settings, overrides] = await Promise.all([
    loadMappings(),
    loadSettings(),
    loadSiteOverrides(),
  ]);

  onStorageChanged((changes) => {
    if (changes.mappings !== undefined) mappings = changes.mappings;
    if (changes.settings !== undefined) settings = changes.settings;
    if (changes.siteOverrides !== undefined) overrides = changes.siteOverrides;
    reevaluate();
    syncEditors();
  });

  reevaluate();
}

void init().catch((e) => console.error(`[${SCRIPT_NAME}] init failed`, e));