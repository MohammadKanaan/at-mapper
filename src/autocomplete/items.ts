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

export function hasMapping(
  mappings: Mappings,
  caseSensitive: boolean,
  word: string,
): boolean {
  if (caseSensitive) {
    return Object.prototype.hasOwnProperty.call(mappings, word);
  }
  const w = word.toLowerCase();
  return Object.keys(mappings).some((k) => k.toLowerCase() === w);
}

export function matchingMappings(
  mappings: Mappings,
  caseSensitive: boolean,
  word: string,
): [string, string][] {
  if (caseSensitive) {
    return Object.entries(mappings)
      .filter(([k]) => k.includes(word))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }
  const w = word.toLowerCase();
  return Object.entries(mappings)
    .filter(([k]) => k.toLowerCase().includes(w))
    .sort((a, b) => a[0].localeCompare(b[0]));
}

export function renderItems(
  container: HTMLElement,
  items: PopupItem[],
  selectedIdx: number,
  trigger: string,
  onApply: (key: string, val: string) => void,
  onSelect: (i: number) => void,
  onActivateAdd: (word: string, el: HTMLElement) => void,
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
        onApply(item.key, item.val);
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