import type { AutocompleteState } from "./items.js";

export function activateAddForm(
  state: AutocompleteState,
  word: string,
  addRowEl: HTMLElement,
  trigger: string,
  addMapping: (key: string, val: string) => void,
  applyMapping: (key: string, val: string) => void,
  hidePopup: () => void,
  updateComboboxAttrs: () => void,
): void {
  if (!state.active || !state.popup) return;
  addRowEl.textContent = "";
  addRowEl.classList.remove("atm-popup__add");
  addRowEl.classList.add("atm-popup__add-form");
  addRowEl.setAttribute("role", "presentation");
  addRowEl.removeAttribute("aria-selected");

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = `Replace "${trigger}${word}" with…`;
  input.setAttribute("aria-label", `Replacement for ${trigger}${word}`);
  addRowEl.appendChild(input);
  input.focus();

  const restore = () => {
    if (!state.popup || !addRowEl.parentNode) return;
    addRowEl.classList.remove("atm-popup__add-form");
    addRowEl.classList.add("atm-popup__add");
    addRowEl.setAttribute("role", "option");
    addRowEl.textContent = `+ Add mapping for "${trigger}${word}"`;
    addRowEl.dataset.word = word;
    state.active?.target.el.focus();
    updateComboboxAttrs();
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const v = input.value.trim();
      if (!v) return;
      addMapping(word, v);
      applyMapping(word, v);
      hidePopup();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      restore();
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      if (!state.popup || !state.popup.contains(input)) return;
      restore();
    }, 150);
  });
}
