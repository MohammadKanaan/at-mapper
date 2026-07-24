import { POPUP_ID } from "../styles.js";
import type { AutocompleteState } from "./items.js";

export function updateComboboxAttrs(state: AutocompleteState): void {
  const el = state.active?.target.el;
  if (!el) return;
  if (state.popup) {
    el.setAttribute("role", "combobox");
    el.setAttribute("aria-controls", POPUP_ID);
    el.setAttribute("aria-expanded", "true");
    const opts = state.popup.querySelectorAll('[role="option"]');
    if (opts[state.selectedIdx]) {
      el.setAttribute("aria-activedescendant", (opts[state.selectedIdx] as HTMLElement).id);
    }
  } else {
    el.removeAttribute("role");
    el.removeAttribute("aria-controls");
    el.removeAttribute("aria-expanded");
    el.removeAttribute("aria-activedescendant");
  }
}