import { injectStyles } from "./styles.js";
import type { Mappings, Settings } from "./types.js";

export interface PanelCallbacks {
  getMappings: () => Mappings;
  getSettings: () => Settings;
  updateSetting: (key: keyof Settings, value: unknown) => void;
  addMapping: (key: string, val: string) => void;
  deleteMapping: (key: string) => void;
}

export interface PanelController {
  ensureFAB(): void;
  removeFAB(): void;
  togglePanel(): void;
  openPanel(): void;
  closePanel(): void;
  destroy(): void;
}

let toastEl: HTMLDivElement | null = null;
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(msg: string): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "atm-toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  requestAnimationFrame(() => toastEl?.classList.add("atm-toast--visible"));
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl?.classList.remove("atm-toast--visible");
  }, 4000);
}

function buildRow(k: string, v: string, onDelete: () => void): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "atm-panel__row";
  const keyEl = document.createElement("span");
  keyEl.className = "atm-panel__row-key";
  keyEl.textContent = "@" + k;
  const arrow = document.createElement("span");
  arrow.className = "atm-panel__row-arrow";
  arrow.textContent = "→";
  const valEl = document.createElement("span");
  valEl.className = "atm-panel__row-val";
  valEl.textContent = v;
  const del = document.createElement("button");
  del.className = "atm-panel__row-del";
  del.textContent = "✕";
  del.setAttribute("aria-label", `Delete mapping for @${k}`);
  del.onclick = onDelete;
  row.append(keyEl, arrow, valEl, del);
  return row;
}

export function createPanel(cb: PanelCallbacks): PanelController {
  injectStyles();

  let fab: HTMLButtonElement | null = null;
  let panel: HTMLDivElement | null = null;
  let panelEscHandler: ((e: KeyboardEvent) => void) | null = null;

  const getMappings = cb.getMappings;
  const getSettings = cb.getSettings;

  function renderList(container: HTMLElement): void {
    container.textContent = "";
    const entries = Object.entries(getMappings()).sort((a, b) =>
      a[0].localeCompare(b[0])
    );
    if (entries.length === 0) {
      const empty = document.createElement("div");
      empty.className = "atm-panel__empty";
      empty.textContent =
        "No mappings yet. Type @word in any text field to add one, or use the form below.";
      container.appendChild(empty);
      return;
    }
    entries.forEach(([k, v]) => {
      const row = buildRow(k, v, () => {
        cb.deleteMapping(k);
        renderList(container);
      });
      container.appendChild(row);
    });
  }

  function openPanel(): void {
    if (panel) return;
    panel = document.createElement("div");
    panel.className = "atm-panel";

    const title = document.createElement("div");
    title.className = "atm-panel__title";
    const titleText = document.createElement("span");
    titleText.textContent = "@-Mappings";
    const close = document.createElement("button");
    close.className = "atm-panel__close";
    close.textContent = "▾";
    close.setAttribute("aria-label", "Close mappings panel");
    close.onclick = closePanel;
    title.append(titleText, close);
    panel.appendChild(title);

    const body = document.createElement("div");
    body.className = "atm-panel__body";

    const list = document.createElement("div");
    list.className = "atm-panel__list";
    renderList(list);
    body.appendChild(list);

    const addForm = document.createElement("div");
    addForm.className = "atm-panel__form";
    const keyInput = document.createElement("input");
    keyInput.placeholder = "@word";
    keyInput.setAttribute("aria-label", "Mapping key");
    const valInput = document.createElement("input");
    valInput.placeholder = "replacement";
    valInput.setAttribute("aria-label", "Replacement value");
    const addBtn = document.createElement("button");
    addBtn.textContent = "Add";

    const doAdd = (): void => {
      const k = keyInput.value.trim().replace(/^@/, "");
      const v = valInput.value.trim();
      if (!k || !v) return;
      cb.addMapping(k, v);
      keyInput.value = "";
      valInput.value = "";
      renderList(list);
      keyInput.focus();
    };

    addBtn.onclick = doAdd;
    keyInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        valInput.focus();
      }
    });
    valInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        doAdd();
      }
    });
    addForm.append(keyInput, valInput, addBtn);
    body.appendChild(addForm);
    panel.appendChild(body);

    const footer = document.createElement("div");
    footer.className = "atm-panel__footer";
    const fabToggle = document.createElement("label");
    fabToggle.className = "atm-panel__toggle";
    const fabCheckbox = document.createElement("input");
    fabCheckbox.type = "checkbox";
    fabCheckbox.checked = getSettings().fabEnabled !== false;
    fabCheckbox.addEventListener("change", () => {
      cb.updateSetting("fabEnabled", fabCheckbox.checked);
      if (fabCheckbox.checked) {
        ensureFAB();
      } else {
        removeFAB();
      }
    });
    fabToggle.append(fabCheckbox, document.createTextNode("Show floating button"));
    footer.appendChild(fabToggle);
    panel.appendChild(footer);

    document.body.appendChild(panel);
    keyInput.focus();

    panelEscHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && panel) {
        e.preventDefault();
        closePanel();
      }
    };
    document.addEventListener("keydown", panelEscHandler);
  }

  function closePanel(): void {
    if (panelEscHandler) {
      document.removeEventListener("keydown", panelEscHandler);
      panelEscHandler = null;
    }
    if (panel) {
      panel.remove();
      panel = null;
    }
  }

  function togglePanel(): void {
    if (panel) {
      closePanel();
    } else {
      openPanel();
    }
  }

  function ensureFAB(): void {
    if (getSettings().fabEnabled === false) return;
    if (fab) return;
    fab = document.createElement("button");
    fab.className = "atm-fab";
    fab.textContent = "@";
    fab.title = "Manage @-mappings";
    fab.setAttribute("aria-label", "Manage @-mappings");
    fab.onclick = togglePanel;
    document.body.appendChild(fab);
  }

  function removeFAB(): void {
    if (fab) {
      fab.remove();
      fab = null;
    }
  }

  function destroy(): void {
    closePanel();
    removeFAB();
    if (toastEl) {
      toastEl.remove();
      toastEl = null;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  return {
    ensureFAB,
    removeFAB,
    togglePanel,
    openPanel,
    closePanel,
    destroy,
  };
}
