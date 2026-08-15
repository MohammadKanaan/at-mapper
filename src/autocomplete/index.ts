import type { EditorTarget, TokenContext } from "../types.js";
import { injectStyles } from "../styles.js";
import { getTokenBeforeCaret, replaceToken } from "../text.js";
import type { AutocompleteState } from "./items.js";
import { hasMapping, matchingMappings } from "./items.js";
import { showPopup, hidePopup } from "./popup.js";
import { updateComboboxAttrs } from "./aria.js";
import { activateAddForm } from "./add-form.js";
import { onKeyDown } from "./keyboard.js";

injectStyles();

export interface AutocompleteCallbacks {
  getMappings: () => Record<string, string>;
  getSettings: () => { trigger: string; caseSensitive: boolean };
  addMapping: (key: string, val: string) => void;
}

export interface AutocompleteController {
  attach(target: EditorTarget): void;
  detach(target: EditorTarget): void;
  hidePopup(): void;
  destroy(): void;
}

export function createAutocomplete(cb: AutocompleteCallbacks): AutocompleteController {
  const state: AutocompleteState = {
    popup: null,
    active: null,
    selectedIdx: 0,
    composing: false,
    blurTimer: null,
    items: [],
    attached: new Map<HTMLElement, EditorTarget>(),
  };

  function getTrigger(): string {
    return cb.getSettings().trigger || "@";
  }

  function isCaseSensitive(): boolean {
    return cb.getSettings().caseSensitive ?? false;
  }

  function setSelected(idx: number): void {
    if (!state.popup) return;
    const items = state.popup.querySelectorAll('[role="option"]');
    if (items.length === 0) return;
    state.selectedIdx = ((idx % items.length) + items.length) % items.length;
    items.forEach((c, i) =>
      c.setAttribute("aria-selected", i === state.selectedIdx ? "true" : "false"),
    );
    items[state.selectedIdx].scrollIntoView({ block: "nearest" });
    updateComboboxAttrs(state);
  }

  function applyMapping(key: string, val: string): void {
    if (!state.active) return hidePopupInternal();
    replaceToken(state.active.target.el, state.active.target.kind, state.active.token, val);
    hidePopupInternal();
  }

  function doActivateAddForm(word: string, el: HTMLElement): void {
    activateAddForm(
      state,
      word,
      el,
      getTrigger(),
      cb.addMapping,
      applyMapping,
      hidePopupInternal,
      () => updateComboboxAttrs(state),
    );
  }

  function showPopupForToken(target: EditorTarget, token: TokenContext): void {
    const trigger = getTrigger();
    const mappings = cb.getMappings();
    const caseSensitive = isCaseSensitive();
    const matches = matchingMappings(mappings, caseSensitive, token.word);
    const hasExisting = hasMapping(mappings, caseSensitive, token.word);
    showPopup(
      state,
      target,
      token,
      trigger,
      matches,
      hasExisting,
      applyMapping,
      setSelected,
      doActivateAddForm,
    );
    updateComboboxAttrs(state);
  }

  function hidePopupInternal(): void {
    hidePopup(state);
    updateComboboxAttrs(state);
  }

  function detectToken(target: EditorTarget): void {
    if (state.composing) return;
    const trigger = getTrigger();
    const token = getTokenBeforeCaret(target.el, target.kind, trigger);
    if (!token) return hidePopupInternal();
    showPopupForToken(target, token);
  }

  function onInput(target: EditorTarget): void {
    detectToken(target);
  }

  function onCompositionStart(): void {
    state.composing = true;
  }

  function onCompositionEnd(target: EditorTarget): void {
    state.composing = false;
    detectToken(target);
  }

  function onBlur(): void {
    state.blurTimer = setTimeout(() => {
      if (state.popup && document.activeElement && state.popup.contains(document.activeElement)) return;
      hidePopupInternal();
    }, 150);
  }

  function hidePopupOnScrollOrResize(e: Event): void {
    if (!state.popup) return;
    if (e.type === "scroll" && state.popup.contains(e.target as Node)) return;
    hidePopupInternal();
  }

  function attach(target: EditorTarget): void {
    if (state.attached.has(target.el)) return;
    const inputHandler = (e: Event) => {
      if (e.target !== target.el) return;
      onInput(target);
    };
    const keydownHandler = (e: KeyboardEvent) =>
      onKeyDown(state, target, e, setSelected, applyMapping, hidePopupInternal, doActivateAddForm);
    const compStartHandler = () => onCompositionStart();
    const compEndHandler = () => onCompositionEnd(target);
    const blurHandler = () => onBlur();

    state.attached.set(target.el, target);
    // keydown in CAPTURE phase so we intercept Enter/Tab/Arrows before the
    // browser's implicit form submission and before site capturing listeners
    // (e.g. YouTube submits its search form on Enter in a capturing listener).
    target.el.addEventListener("input", inputHandler);
    target.el.addEventListener("keydown", keydownHandler, true);
    target.el.addEventListener("compositionstart", compStartHandler);
    target.el.addEventListener("compositionend", compEndHandler);
    target.el.addEventListener("blur", blurHandler);

    (target.el as unknown as { __atm_cleanup?: () => void }).__atm_cleanup = () => {
      target.el.removeEventListener("input", inputHandler);
      target.el.removeEventListener("keydown", keydownHandler, true);
      target.el.removeEventListener("compositionstart", compStartHandler);
      target.el.removeEventListener("compositionend", compEndHandler);
      target.el.removeEventListener("blur", blurHandler);
      state.attached.delete(target.el);
    };
  }

  function detach(target: EditorTarget): void {
    const cleanup = (target.el as unknown as { __atm_cleanup?: () => void }).__atm_cleanup;
    if (cleanup) {
      cleanup();
      delete (target.el as unknown as { __atm_cleanup?: () => void }).__atm_cleanup;
    }
    if (state.active?.target.el === target.el) {
      hidePopupInternal();
    }
  }

  function destroy(): void {
    hidePopupInternal();
    for (const target of state.attached.values()) {
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
    hidePopup: hidePopupInternal,
    destroy,
  };
}