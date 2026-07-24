import type { EditorTarget, TokenContext } from "../types.js";
import { POPUP_ID, POPUP_GAP, POPUP_MAX_HEIGHT } from "../styles.js";
import { getCaretCoords } from "../caret.js";
import type { AutocompleteState, PopupItem } from "./items.js";
import { renderItems } from "./items.js";

export function clampPopupLeft(
  preferredLeft: number,
  viewportWidth: number,
  popupWidth: number,
  gap: number,
): number {
  const maxLeft = Math.max(gap, viewportWidth - popupWidth - gap);
  return Math.max(gap, Math.min(preferredLeft, maxLeft));
}

export function placePopup(
  state: AutocompleteState,
  target: EditorTarget,
): void {
  if (!state.popup || !state.active) return;
  const coords = getCaretCoords(target.el, target.kind, state.active.token.start);
  const below = coords.bottom + POPUP_GAP;
  if (below + POPUP_MAX_HEIGHT > window.innerHeight) {
    state.popup.style.top = `${Math.max(POPUP_GAP, coords.top - POPUP_MAX_HEIGHT - POPUP_GAP)}px`;
  } else {
    state.popup.style.top = `${below}px`;
  }
  const popupWidth = state.popup.getBoundingClientRect().width || 220;
  state.popup.style.left = `${clampPopupLeft(coords.left, window.innerWidth, popupWidth, POPUP_GAP)}px`;
}

export function showPopup(
  state: AutocompleteState,
  target: EditorTarget,
  token: TokenContext,
  trigger: string,
  matches: [string, string][],
  hasExisting: boolean,
  onApply: (key: string, val: string) => void,
  onSelect: (i: number) => void,
  onActivateAdd: (word: string, el: HTMLElement) => void,
): void {
  hidePopup(state);
  if (matches.length === 0 && !token.word) return;

  const items: PopupItem[] = matches.map(([key, val]) => ({ type: "mapping", key, val }));
  if (token.word && !hasExisting) {
    items.push({ type: "add", word: token.word });
  }
  if (items.length === 0) return;

  state.selectedIdx = matches.length === 0 ? items.length - 1 : 0;
  state.active = { target, token };
  state.items = items;

  const popup = document.createElement("div");
  popup.className = "atm-popup";
  popup.id = POPUP_ID;
  popup.setAttribute("role", "listbox");
  popup.setAttribute("aria-label", "Matching shortcuts");

  renderItems(popup, items, state.selectedIdx, trigger, onApply, onSelect, onActivateAdd);

  document.body.appendChild(popup);
  state.popup = popup;
  placePopup(state, target);
}

export function hidePopup(state: AutocompleteState): void {
  if (state.blurTimer) {
    clearTimeout(state.blurTimer);
    state.blurTimer = null;
  }
  if (state.popup) {
    state.popup.remove();
    state.popup = null;
  }
  state.active = null;
  state.selectedIdx = 0;
  state.items = [];
}
