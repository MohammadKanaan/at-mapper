import type { Mappings, Settings, EditorKind, EditorTarget, TokenContext } from "./types.js";
import { injectStyles, POPUP_ID, POPUP_GAP, POPUP_MAX_HEIGHT } from "./styles.js";
import { getCaretCoords } from "./caret.js";
import { getTokenBeforeCaret, replaceToken } from "./text.js";

injectStyles();

type PopupItem =
  | { type: "mapping"; key: string; val: string }
  | { type: "add"; word: string }
  | { type: "manage" };

export interface AutocompleteCallbacks {
  getMappings: () => Mappings;
  getSettings: () => Settings;
  addMapping: (key: string, val: string) => void;
  openPanel: () => void;
}

export interface AutocompleteController {
  attach(target: EditorTarget): void;
  detach(target: EditorTarget): void;
  hidePopup(): void;
  destroy(): void;
}

interface ActiveState {
  target: EditorTarget;
  token: TokenContext;
}

export function createAutocomplete(cb: AutocompleteCallbacks): AutocompleteController {
  let popup: HTMLElement | null = null;
  let active: ActiveState | null = null;
  let selectedIdx = 0;
  let composing = false;
  let blurTimer: ReturnType<typeof setTimeout> | null = null;
  const attached = new Map<HTMLElement, EditorTarget>();

  function currentItems(): PopupItem[] {
    const ctx = popup?.getAttribute("role") === "listbox" ? popup : null;
    if (!ctx) return [];
    const items: PopupItem[] = [];
    for (let i = 0; i < ctx.children.length; i++) {
      const child = ctx.children[i];
      if (!(child instanceof HTMLElement)) continue;
      if (child.classList.contains("atm-popup__item")) {
        const key = child.dataset.key ?? "";
        const val = child.dataset.val ?? "";
        items.push({ type: "mapping", key, val });
      } else if (child.classList.contains("atm-popup__add")) {
        const word = child.dataset.word ?? "";
        items.push({ type: "add", word });
      } else if (child.classList.contains("atm-popup__manage")) {
        items.push({ type: "manage" });
      }
    }
    return items;
  }

  function getTrigger(): string {
    return cb.getSettings().trigger || "@";
  }

  function isCaseSensitive(): boolean {
    return cb.getSettings().caseSensitive ?? false;
  }

  function hasMapping(word: string): boolean {
    const mappings = cb.getMappings();
    if (isCaseSensitive()) {
      return Object.prototype.hasOwnProperty.call(mappings, word);
    }
    const w = word.toLowerCase();
    return Object.keys(mappings).some((k) => k.toLowerCase() === w);
  }

  function matchingMappings(word: string): [string, string][] {
    const mappings = cb.getMappings();
    if (isCaseSensitive()) {
      return Object.entries(mappings)
        .filter(([k]) => k.includes(word))
        .sort((a, b) => a[0].localeCompare(b[0]));
    }
    const w = word.toLowerCase();
    return Object.entries(mappings)
      .filter(([k]) => k.toLowerCase().includes(w))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }

  function updateComboboxAttrs() {
    const el = active?.target.el;
    if (!el) return;
    if (popup) {
      el.setAttribute("role", "combobox");
      el.setAttribute("aria-controls", POPUP_ID);
      el.setAttribute("aria-expanded", "true");
      const opts = popup.querySelectorAll('[role="option"]');
      if (opts[selectedIdx]) {
        el.setAttribute("aria-activedescendant", (opts[selectedIdx] as HTMLElement).id);
      }
    } else {
      el.removeAttribute("role");
      el.removeAttribute("aria-controls");
      el.removeAttribute("aria-expanded");
      el.removeAttribute("aria-activedescendant");
    }
  }

  function setSelected(idx: number) {
    if (!popup) return;
    const items = popup.querySelectorAll('[role="option"]');
    if (items.length === 0) return;
    selectedIdx = ((idx % items.length) + items.length) % items.length;
    items.forEach((c, i) =>
      c.setAttribute("aria-selected", i === selectedIdx ? "true" : "false")
    );
    items[selectedIdx].scrollIntoView({ block: "nearest" });
    updateComboboxAttrs();
  }

  function placePopup(target: EditorTarget) {
    if (!popup || !active) return;
    const coords = getCaretCoords(target.el, target.kind, active.token.start);
    const below = coords.bottom + POPUP_GAP;
    if (below + POPUP_MAX_HEIGHT > window.innerHeight) {
      popup.style.top = `${Math.max(POPUP_GAP, coords.top - POPUP_MAX_HEIGHT - POPUP_GAP)}px`;
    } else {
      popup.style.top = `${below}px`;
    }
    popup.style.left = `${Math.min(coords.left, window.innerWidth - 220)}px`;
  }

  function applyMapping(key: string, val: string) {
    if (!active) return hidePopup();
    replaceToken(active.target.el, active.target.kind, active.token, val);
    hidePopup();
  }

  function activateAddForm(word: string, addRowEl: HTMLElement) {
    if (!active || !popup) return;
    addRowEl.textContent = "";
    addRowEl.classList.remove("atm-popup__add");
    addRowEl.classList.add("atm-popup__add-form");
    addRowEl.setAttribute("role", "presentation");
    addRowEl.removeAttribute("aria-selected");

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = `Replace "${getTrigger()}${word}" with…`;
    input.setAttribute("aria-label", `Replacement for ${getTrigger()}${word}`);
    addRowEl.appendChild(input);
    input.focus();

    const restore = () => {
      if (!popup || !addRowEl.parentNode) return;
      addRowEl.classList.remove("atm-popup__add-form");
      addRowEl.classList.add("atm-popup__add");
      addRowEl.setAttribute("role", "option");
      addRowEl.textContent = `+ Add mapping for "${getTrigger()}${word}"`;
      addRowEl.dataset.word = word;
      active?.target.el.focus();
      updateComboboxAttrs();
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const v = input.value.trim();
        if (!v) return;
        cb.addMapping(word, v);
        hidePopup();
        applyMapping(word, v);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        restore();
      }
    });

    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (!popup || !popup.contains(input)) return;
        restore();
      }, 150);
    });
  }

  function showPopup(target: EditorTarget, token: TokenContext) {
    hidePopup();
    const trigger = getTrigger();
    const matches = matchingMappings(token.word);
    if (matches.length === 0 && !token.word) return;

    const items: PopupItem[] = matches.map(([key, val]) => ({ type: "mapping", key, val }));
    if (token.word && !hasMapping(token.word)) {
      items.push({ type: "add", word: token.word });
    }
    if (items.length === 0) return;

    selectedIdx = matches.length === 0 ? items.length - 1 : 0;
    active = { target, token };

    popup = document.createElement("div");
    popup.className = "atm-popup";
    popup.id = POPUP_ID;
    popup.setAttribute("role", "listbox");

    const container = popup;

    items.forEach((item, i) => {
      if (item.type === "mapping") {
        const el = document.createElement("div");
        el.className = "atm-popup__item";
        el.id = `atm-opt-${i}`;
        el.setAttribute("role", "option");
        el.setAttribute("aria-selected", i === selectedIdx ? "true" : "false");
        el.dataset.key = item.key;
        el.dataset.val = item.val;
        const k = document.createElement("span");
        k.className = "atm-popup__key";
        k.textContent = trigger + item.key;
        const v = document.createElement("span");
        v.className = "atm-popup__val";
        v.textContent = "→ " + item.val;
        el.append(k, v);
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          applyMapping(item.key, item.val);
        });
        el.addEventListener("mouseenter", () => setSelected(i));
        container.appendChild(el);
      } else if (item.type === "add") {
        const el = document.createElement("div");
        el.className = "atm-popup__add";
        el.id = `atm-opt-${i}`;
        el.setAttribute("role", "option");
        el.setAttribute("aria-selected", i === selectedIdx ? "true" : "false");
        el.dataset.word = item.word;
        el.textContent = `+ Add mapping for "${trigger}${item.word}"`;
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          activateAddForm(item.word, el);
        });
        el.addEventListener("mouseenter", () => setSelected(i));
        container.appendChild(el);
      }
    });

    const manageRow = document.createElement("div");
    manageRow.className = "atm-popup__manage";
    manageRow.id = `atm-opt-${items.length}`;
    manageRow.setAttribute("role", "option");
    manageRow.setAttribute("aria-selected", "false");
    manageRow.textContent = "Manage mappings…";
    manageRow.addEventListener("mousedown", (e) => {
      e.preventDefault();
      hidePopup();
      cb.openPanel();
    });
    manageRow.addEventListener("mouseenter", () => setSelected(items.length));
    popup.appendChild(manageRow);

    document.body.appendChild(container);
    placePopup(target);
    updateComboboxAttrs();
  }

  function hidePopup() {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    if (popup) {
      popup.remove();
      popup = null;
    }
    active = null;
    selectedIdx = 0;
    updateComboboxAttrs();
  }

  function detectToken(target: EditorTarget) {
    if (composing) return;
    const trigger = getTrigger();
    const token = getTokenBeforeCaret(target.el, target.kind, trigger);
    if (!token) return hidePopup();
    showPopup(target, token);
  }

  function onKeyDown(target: EditorTarget, e: KeyboardEvent) {
    if (!popup) return;
    if (composing) return;
    const items = popup.querySelectorAll('[role="option"]');
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (items.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      setSelected(selectedIdx + (e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter" || e.key === "Tab") {
      const item = currentItems()[selectedIdx];
      if (!item) return;
      e.preventDefault();
      e.stopPropagation();
      if (item.type === "mapping") {
        applyMapping(item.key, item.val);
      } else if (item.type === "manage") {
        hidePopup();
        cb.openPanel();
      } else {
        const addRowEl = items[selectedIdx] as HTMLElement;
        activateAddForm(item.word, addRowEl);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      hidePopup();
    }
  }

  function onInput(target: EditorTarget) {
    detectToken(target);
  }

  function onCompositionStart() {
    composing = true;
  }

  function onCompositionEnd(target: EditorTarget) {
    composing = false;
    detectToken(target);
  }

  function onBlur() {
    blurTimer = setTimeout(() => {
      if (popup && document.activeElement && popup.contains(document.activeElement)) return;
      hidePopup();
    }, 150);
  }

  function hidePopupOnScrollOrResize(e: Event) {
    if (!popup) return;
    if (e.type === "scroll" && popup.contains(e.target as Node)) return;
    hidePopup();
  }

  function attach(target: EditorTarget) {
    if (attached.has(target.el)) return;
    const inputHandler = (e: Event) => {
      if (e.target !== target.el) return;
      onInput(target);
    };
    const keydownHandler = (e: KeyboardEvent) => onKeyDown(target, e);
    const compStartHandler = () => onCompositionStart();
    const compEndHandler = () => onCompositionEnd(target);
    const blurHandler = () => onBlur();

    attached.set(target.el, target);
    target.el.addEventListener("input", inputHandler);
    target.el.addEventListener("keydown", keydownHandler);
    target.el.addEventListener("compositionstart", compStartHandler);
    target.el.addEventListener("compositionend", compEndHandler);
    target.el.addEventListener("blur", blurHandler);

    (target.el as unknown as { __atm_cleanup?: () => void }).__atm_cleanup = () => {
      target.el.removeEventListener("input", inputHandler);
      target.el.removeEventListener("keydown", keydownHandler);
      target.el.removeEventListener("compositionstart", compStartHandler);
      target.el.removeEventListener("compositionend", compEndHandler);
      target.el.removeEventListener("blur", blurHandler);
      attached.delete(target.el);
    };
  }

  function detach(target: EditorTarget) {
    const cleanup = (target.el as unknown as { __atm_cleanup?: () => void }).__atm_cleanup;
    if (cleanup) {
      cleanup();
      delete (target.el as unknown as { __atm_cleanup?: () => void }).__atm_cleanup;
    }
    if (active?.target.el === target.el) {
      hidePopup();
    }
  }

  function destroy() {
    hidePopup();
    for (const target of attached.values()) {
      detach(target);
    }
    window.removeEventListener("scroll", hidePopupOnScrollOrResize, true);
    window.removeEventListener("resize", hidePopupOnScrollOrResize);
  }

  window.addEventListener("scroll", hidePopupOnScrollOrResize, true);
  window.addEventListener("resize", hidePopupOnScrollOrResize);

  return {
    attach,
    detach,
    hidePopup,
    destroy,
  };
}
