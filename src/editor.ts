import type { EditorTarget, EditorKind } from "./types.js";

function isOurUI(el: Element): boolean {
  if (el.id.startsWith("atm-")) return true;
  if (el instanceof HTMLElement) {
    for (const c of el.classList) {
      if (c.startsWith("atm-")) return true;
    }
  }
  return false;
}

function isContentEditable(el: HTMLElement): boolean {
  const ce = el.getAttribute("contenteditable");
  if (ce === "" || ce === "true") return true;
  if (el.getAttribute("role") === "textbox" && el.isContentEditable) return true;
  return false;
}

function isVisible(el: HTMLElement): boolean {
  if (el.tagName === "TEXTAREA") {
    return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
  }
  return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
}

function kindOf(el: HTMLElement): EditorKind | null {
  if (el.tagName === "TEXTAREA") return "textarea";
  if (isContentEditable(el)) return "contenteditable";
  return null;
}

export function findEditors(root: ParentNode = document.body): EditorTarget[] {
  const found: EditorTarget[] = [];
  const seen = new Set<Element>();

  const candidates: Element[] = [];
  candidates.push(...root.querySelectorAll("textarea"));
  candidates.push(...root.querySelectorAll('[contenteditable=""]'));
  candidates.push(...root.querySelectorAll('[contenteditable="true"]'));
  candidates.push(...root.querySelectorAll('[role="textbox"]'));

  for (const cand of candidates) {
    if (!(cand instanceof HTMLElement)) continue;
    if (seen.has(cand)) continue;
    if (isOurUI(cand)) continue;
    if (cand.closest("[class*='atm-']") || cand.closest("[id^='atm-']")) continue;
    if (!isVisible(cand)) continue;
    const kind = kindOf(cand);
    if (!kind) continue;
    seen.add(cand);
    found.push({ el: cand, kind });
  }

  return found;
}

export function isEditableTarget(el: EventTarget | null): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (isOurUI(el)) return false;
  return kindOf(el) !== null;
}

export function observeEditors(onChange: (targets: EditorTarget[]) => void): () => void {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      onChange(findEditors());
    });
  };

  const observer = new MutationObserver(() => schedule());
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}