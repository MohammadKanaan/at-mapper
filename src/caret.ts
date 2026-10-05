import { FALLBACK_LINE_HEIGHT_PX } from "./constants.js";
import type { EditorKind, CaretCoords } from "./types.js";

const CARET_MIRROR_PROPS = [
  "boxSizing", "width", "height", "overflowX", "overflowY",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
  "fontSizeAdjust", "lineHeight", "fontFamily", "textAlign", "textTransform",
  "textIndent", "textDecoration", "letterSpacing", "wordSpacing", "tabSize",
];

function buildMirror(src: HTMLTextAreaElement | HTMLInputElement, position: number, wrap: boolean): { coords: { left: number; top: number }; lh: number } {
  const div = document.createElement("div");
  const style = getComputedStyle(src);
  const span = document.createElement("span");
  // eslint-disable-next-line no-useless-assignment
  let coords = { left: 0, top: 0 };
  try {
    Object.assign(div.style, {
      position: "absolute",
      whiteSpace: wrap ? "pre-wrap" : "pre",
      visibility: "hidden",
    });
    CARET_MIRROR_PROPS.forEach((p) => {
      const v = style.getPropertyValue(p.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase()));
      div.style.setProperty(p, v);
    });
    div.textContent = src.value.slice(0, position);
    span.textContent = src.value.slice(position) || ".";
    div.appendChild(span);
    document.body.appendChild(div);
    const rect = src.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    coords = {
      left: rect.left + spanRect.left - div.getBoundingClientRect().left + src.scrollLeft,
      top: rect.top + spanRect.top - div.getBoundingClientRect().top - src.scrollTop,
    };
  } finally {
    if (div.parentNode) div.parentNode.removeChild(div);
  }
  const lh = parseFloat(style.lineHeight) || FALLBACK_LINE_HEIGHT_PX;
  return { coords, lh };
}

function getCaretCoordsText(
  el: HTMLTextAreaElement | HTMLInputElement,
  position: number,
  wrap: boolean,
): CaretCoords {
  const { coords, lh } = buildMirror(el, position, wrap);
  return { left: coords.left, top: coords.top, bottom: coords.top + lh, height: lh };
}

function getCaretCoordsContenteditable(el: HTMLElement): CaretCoords {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    return { left: 0, top: 0, bottom: 0, height: FALLBACK_LINE_HEIGHT_PX };
  }
  const range = sel.getRangeAt(0).cloneRange();
  const rects = range.getClientRects();
  let rect: DOMRect | null = null;
  if (rects.length > 0) {
    rect = rects[rects.length - 1];
  } else if (range.collapsed) {
    const { startContainer, startOffset } = range;
    const probe = range.cloneRange();
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const tn = startContainer as Text;
      if (startOffset > 0) {
        probe.setStart(startContainer, startOffset - 1);
        probe.setEnd(startContainer, startOffset);
      } else if (startOffset < tn.length) {
        probe.setStart(startContainer, startOffset);
        probe.setEnd(startContainer, startOffset + 1);
      }
    }
    const probeRect = probe.getBoundingClientRect();
    if (probeRect.width > 0) {
      rect = probeRect;
    } else {
      const zws = document.createTextNode("\uFEFF");
      range.insertNode(zws);
      const zwsRect = range.getBoundingClientRect();
      zws.remove();
      if (zwsRect.width > 0 || zwsRect.height > 0) rect = zwsRect;
    }
  }

  if (!rect) {
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top, bottom: r.bottom, height: r.height || FALLBACK_LINE_HEIGHT_PX };
  }
  const height = rect.height || FALLBACK_LINE_HEIGHT_PX;
  return { left: rect.left, top: rect.top, bottom: rect.top + height, height };
}

export function getCaretCoords(el: HTMLElement, kind: EditorKind, pos: number): CaretCoords {
  if (kind === "textarea") {
    return getCaretCoordsText(el as HTMLTextAreaElement, pos, true);
  }
  if (kind === "input") {
    return getCaretCoordsText(el as HTMLInputElement, pos, false);
  }
  return getCaretCoordsContenteditable(el);
}
