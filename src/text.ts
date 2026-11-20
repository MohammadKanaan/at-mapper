import type { EditorKind, TokenContext } from "./types.js";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches a trigger followed by a run of non-whitespace, non-trigger characters at end of text. */
function tokenRegex(trigger: string): RegExp {
  const t = escapeRegExp(trigger);
  return new RegExp(t + "([^\\s" + t + "]+)$");
}

function setNativeValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  // React overrides the value setter on controlled inputs; setting .value
  // directly via assignment is intercepted by React's tracker in dev and
  // ignored in prod for controlled components. Use the native prototype setter
  // then dispatch an InputEvent so framework state stays in sync.
  const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
}

function dispatchInput(el: HTMLInputElement | HTMLTextAreaElement): void {
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: null, inputType: "insertText" }));
}

function getTextBeforeCaretContenteditable(el: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.endContainer, range.endOffset);
  const frag = pre.cloneContents();
  let text = "";
  const walker = document.createTreeWalker(frag, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
      const tag = (node as Element).tagName;
      if (tag === "BR") return NodeFilter.FILTER_ACCEPT;
      if (tag === "DIV" || tag === "P") return NodeFilter.FILTER_ACCEPT;
      return NodeFilter.FILTER_SKIP;
    },
  });
  let prevWasBlock = false;
  let first = true;
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) {
      text += n.textContent ?? "";
      prevWasBlock = false;
    } else {
      const tag = (n as Element).tagName;
      if (tag === "BR") {
        text += "\n";
      } else if (!first && !prevWasBlock) {
        text += "\n";
      }
      prevWasBlock = true;
    }
    first = false;
  }
  return text;
}

/**
 * Builds a range covering the `length` text characters that end at the caret.
 * A token has no whitespace, so it never spans a line break and walking back
 * over text nodes alone matches the text model in getTextBeforeCaretContenteditable.
 */
function tokenRangeBeforeCaret(el: HTMLElement, length: number): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const caret = sel.getRangeAt(0);
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(caret.endContainer, caret.endOffset);

  const nodes: Text[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (pre.intersectsNode(n)) nodes.push(n as Text);
  }

  let remaining = length;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const tn = nodes[i];
    const end = tn === caret.endContainer ? caret.endOffset : tn.length;
    if (end >= remaining) {
      const r = document.createRange();
      r.setStart(tn, end - remaining);
      r.setEnd(caret.endContainer, caret.endOffset);
      return r;
    }
    remaining -= end;
  }
  return null;
}

export function getTokenBeforeCaret(el: HTMLElement, kind: EditorKind, trigger: string): TokenContext | null {
  let before: string;
  let caretPos: number;
  if (kind === "textarea" || kind === "input") {
    const ta = el as HTMLTextAreaElement | HTMLInputElement;
    caretPos = ta.selectionStart ?? 0;
    before = ta.value.slice(0, caretPos);
  } else {
    before = getTextBeforeCaretContenteditable(el);
    caretPos = before.length;
  }
  const m = before.match(tokenRegex(trigger));
  if (!m) return null;
  const word = m[1];
  const start = caretPos - m[0].length;
  const end = caretPos;
  if (kind === "contenteditable") {
    const range = tokenRangeBeforeCaret(el, m[0].length);
    if (!range) return null;
    return { trigger, word, start, end, range };
  }
  return { trigger, word, start, end };
}

export function replaceToken(el: HTMLElement, kind: EditorKind, token: TokenContext, replacement: string): boolean {
  if (kind === "textarea" || kind === "input") {
    const ta = el as HTMLTextAreaElement | HTMLInputElement;
    const pos = ta.selectionStart ?? 0;
    const before = ta.value.slice(0, pos);
    const after = ta.value.slice(pos);
    const m = before.match(tokenRegex(token.trigger));
    if (!m) return false;
    const tokenStart = pos - m[0].length;
    const newValue = ta.value.slice(0, tokenStart) + replacement + after;
    setNativeValue(ta, newValue);
    const newPos = tokenStart + replacement.length;
    ta.focus();
    ta.setSelectionRange(newPos, newPos);
    dispatchInput(ta);
    return true;
  }

  // The range is live, so edits since detection move or collapse it. Only
  // replace when it still covers exactly the token, never neighbouring text.
  const live = token.range;
  if (!live || !el.contains(live.commonAncestorContainer) || live.toString() !== token.trigger + token.word) {
    return false;
  }
  const r = live.cloneRange();
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  sel.addRange(r);

  let ok: boolean;
  try {
    ok = document.execCommand("insertText", false, replacement);
  } catch {
    ok = false;
  }
  if (!ok) {
    r.deleteContents();
    const tn = document.createTextNode(replacement);
    r.insertNode(tn);
    r.setStartAfter(tn);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
  return true;
}

