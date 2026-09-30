import type { AutocompleteState } from "./items.js";

export function onKeyDown(
  state: AutocompleteState,
  e: KeyboardEvent,
  setSelected: (idx: number) => void,
  applyMapping: (val: string) => void,
  hidePopup: () => void,
  activateAddForm: (word: string, el: HTMLElement) => void,
): void {
  if (!state.popup) return;
  if (state.composing) return;
  const items = state.popup.querySelectorAll('[role="option"]');
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    if (items.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelected(state.selectedIdx + (e.key === "ArrowDown" ? 1 : -1));
  } else if (e.key === "Enter" || e.key === "Tab") {
    const item = state.items[state.selectedIdx];
    if (!item) return;
    e.preventDefault();
    e.stopPropagation();
    if (item.type === "mapping") {
      applyMapping(item.val);
    } else {
      const addRowEl = items[state.selectedIdx] as HTMLElement;
      activateAddForm(item.word, addRowEl);
    }
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    hidePopup();
  }
}