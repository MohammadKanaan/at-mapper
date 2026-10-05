import {
  loadMappings,
  loadSettings,
  loadSiteOverrides,
  saveMappings,
  onStorageChanged,
} from "./storage.js";
import { currentHostname, isSiteEnabled } from "./host.js";
import { findEditors, observeEditors } from "./editor.js";
import { createAutocomplete } from "./autocomplete/index.js";
import { showToast } from "./toast.js";
import { applyContentTheme } from "./styles.js";
import type { EditorTarget, Mappings, Settings, SiteOverrides } from "./types.js";

const SCRIPT_NAME = "@-Mapper";

let mappings: Mappings = {};
let settings: Settings;
let overrides: SiteOverrides = {};
const attached = new Map<HTMLElement, EditorTarget>();
let detachObserver: () => void = () => {};
let active = false;

function setMapping(key: string, val: string): void {
  mappings = { ...mappings, [key]: val };
  void saveMappings(mappings).catch(() => showToast(`${SCRIPT_NAME}: could not save`));
}

const autocomplete = createAutocomplete({
  getMappings: () => mappings,
  getSettings: () => settings,
  addMapping: setMapping,
});

function syncEditors(targets: EditorTarget[] = findEditors()): void {
  if (!active) return;
  const next = new Set(targets.map((t) => t.el));

  for (const [el, target] of attached) {
    if (!next.has(el)) {
      autocomplete.detach(target);
      attached.delete(el);
    }
  }
  for (const t of targets) {
    if (!attached.has(t.el)) {
      autocomplete.attach(t);
      attached.set(t.el, t);
    }
  }
}

function activate(): void {
  if (active) return;
  active = true;
  detachObserver = observeEditors((targets) => syncEditors(targets));
  syncEditors();
}

function deactivate(): void {
  if (!active) return;
  active = false;
  detachObserver();
  detachObserver = () => {};
  for (const target of attached.values()) {
    autocomplete.detach(target);
  }
  attached.clear();
  autocomplete.hidePopup();
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

  applyContentTheme(settings.theme);

  onStorageChanged((changes) => {
    if (changes.mappings !== undefined) mappings = changes.mappings;
    if (changes.settings !== undefined) {
      settings = changes.settings;
      applyContentTheme(settings.theme);
    }
    if (changes.siteOverrides !== undefined) overrides = changes.siteOverrides;
    reevaluate();
    syncEditors();
  });

  reevaluate();
}

void init().catch((e) => console.error(`[${SCRIPT_NAME}] init failed`, e));