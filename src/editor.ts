import type { EditorTarget, EditorKind } from "./types.js";

// Per the HTML spec, only these input types support the selection API
// (selectionStart/setSelectionRange), which our token detection relies on.
// Exclude password for UX/security, and email/number because they throw on
// selection access. YouTube/Google search inputs are type="text"/"search".
const TEXT_INPUT_TYPES = new Set(["text", "search", "url", "tel", ""]);

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
  return el.offsetParent !== null || getComputedStyle(el).position === "fixed";
}

function isTextInput(el: HTMLInputElement): boolean {
  const type = (el.type || "text").toLowerCase();
  return TEXT_INPUT_TYPES.has(type);
}

function kindOf(el: HTMLElement): EditorKind | null {
  if (el.tagName === "TEXTAREA") return "textarea";
  if (el instanceof HTMLInputElement && isTextInput(el)) return "input";
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
  candidates.push(...root.querySelectorAll("input"));

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