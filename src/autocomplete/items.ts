import type { EditorTarget, Mappings, TokenContext } from "../types.js";

export type PopupItem =
  | { type: "mapping"; key: string; val: string }
  | { type: "add"; word: string };

export interface ActiveState {
  target: EditorTarget;
  token: TokenContext;
}

// Ownership boundary: index.ts owns the single mutable AutocompleteState instance
// and passes it to the helper modules. Helpers mutate state.* in place — this
// preserves the original closure-based sharing semantics.
export interface AutocompleteState {
  popup: HTMLElement | null;
  active: ActiveState | null;
  selectedIdx: number;
  composing: boolean;
  blurTimer: ReturnType<typeof setTimeout> | null;
  items: PopupItem[];
  attached: Map<HTMLElement, EditorTarget>;
}

function normalizer(caseSensitive: boolean): (s: string) => string {
  return caseSensitive ? (s) => s : (s) => s.toLowerCase();
}

export function hasMapping(mappings: Mappings, caseSensitive: boolean, word: string): boolean {
  const norm = normalizer(caseSensitive);
  const w = norm(word);
  return Object.keys(mappings).some((k) => norm(k) === w);
}

export function matchingMappings(
  mappings: Mappings,
  caseSensitive: boolean,
  word: string,
): [string, string][] {
  const norm = normalizer(caseSensitive);
  const w = norm(word);
  return Object.entries(mappings)
    .filter(([k]) => norm(k).includes(w))
    .sort((a, b) => a[0].localeCompare(b[0]));
}

/** Callbacks the popup UI uses to report user interaction back to the controller. */
export interface PopupHandlers {
  onApply: (val: string) => void;
  onSelect: (idx: number) => void;
  onActivateAdd: (word: string, el: HTMLElement) => void;
}

export function renderItems(
  container: HTMLElement,
  items: PopupItem[],
  selectedIdx: number,
  trigger: string,
  { onApply, onSelect, onActivateAdd }: PopupHandlers,
): void {
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
        onApply(item.val);
      });
      el.addEventListener("mouseenter", () => onSelect(i));
      container.appendChild(el);
    } else {
      const el = document.createElement("div");
      el.className = "atm-popup__add";
      el.id = `atm-opt-${i}`;
      el.setAttribute("role", "option");
      el.setAttribute("aria-selected", i === selectedIdx ? "true" : "false");
      el.dataset.word = item.word;
      el.textContent = `+ Add mapping for "${trigger}${item.word}"`;
      el.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onActivateAdd(item.word, el);
      });
      el.addEventListener("mouseenter", () => onSelect(i));
      container.appendChild(el);
    }
  });
}