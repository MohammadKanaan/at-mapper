export const STYLE_ID = "atm-styles";

export const CSS_VARS = {
  bg: "var(--background, #fff)",
  fg: "var(--foreground, #111)",
  muted: "var(--muted-foreground, #666)",
  border: "var(--border, #ddd)",
  accent: "var(--accent, rgba(0,0,0,0.05))",
};

export const Z = { popup: 99999, panel: 99998, fab: 99997, toast: 99996 };

export const POPUP_MAX_HEIGHT = 260;
export const POPUP_GAP = 4;
export const POPUP_ID = "atm-popup";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .atm-popup {
      position: fixed;
      z-index: ${Z.popup};
      background: ${CSS_VARS.bg};
      color: ${CSS_VARS.fg};
      border: 1px solid ${CSS_VARS.border};
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      min-width: 200px;
      max-height: ${POPUP_MAX_HEIGHT}px;
      overflow-y: auto;
      font-size: 13px;
      padding: 4px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .atm-popup__item,
    .atm-popup__add,
    .atm-popup__manage {
      padding: 6px 10px;
      cursor: pointer;
      border-radius: 6px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .atm-popup__item:hover,
    .atm-popup__item[aria-selected="true"],
    .atm-popup__add:hover,
    .atm-popup__add[aria-selected="true"],
    .atm-popup__manage:hover,
    .atm-popup__manage[aria-selected="true"] {
      background: ${CSS_VARS.accent};
    }
    .atm-popup__key { color: ${CSS_VARS.muted}; flex-shrink: 0; }
    .atm-popup__val { font-weight: 500; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .atm-popup__add,
    .atm-popup__manage {
      border-top: 1px solid ${CSS_VARS.border};
      border-radius: 0 0 6px 6px;
      font-size: 12px;
      color: ${CSS_VARS.muted};
      margin-top: 2px;
    }
    .atm-popup__add-form {
      padding: 6px 10px;
      border-top: 1px solid ${CSS_VARS.border};
      display: flex;
      gap: 6px;
    }
    .atm-popup__add-form input {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      font-size: 12px;
      border: 1px solid ${CSS_VARS.border};
      border-radius: 6px;
      background: ${CSS_VARS.bg};
      color: ${CSS_VARS.fg};
      outline: none;
    }
    .atm-popup__add-form input:focus { border-color: ${CSS_VARS.fg}; }

    .atm-panel {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 320px;
      max-height: 420px;
      background: ${CSS_VARS.bg};
      color: ${CSS_VARS.fg};
      border: 1px solid ${CSS_VARS.border};
      border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.16);
      z-index: ${Z.panel};
      font-size: 13px;
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      flex-direction: column;
    }
    .atm-panel__title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      font-size: 14px;
      padding: 14px 14px 10px;
      flex-shrink: 0;
    }
    .atm-panel__body { overflow-y: auto; padding: 0 14px; }
    .atm-panel__footer {
      flex-shrink: 0;
      padding: 10px 14px 14px;
      border-top: 1px solid ${CSS_VARS.border};
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .atm-panel__close {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 20px;
      color: ${CSS_VARS.muted};
      line-height: 1;
      padding: 4px 8px;
      margin: -4px -8px 0 0;
      border-radius: 6px;
    }
    .atm-panel__close:hover { color: ${CSS_VARS.fg}; background: ${CSS_VARS.accent}; }
    .atm-panel__list { display: flex; flex-direction: column; gap: 2px; margin-bottom: 10px; }
    .atm-panel__row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      border-radius: 6px;
    }
    .atm-panel__row:hover { background: ${CSS_VARS.accent}; }
    .atm-panel__row-key { color: ${CSS_VARS.muted}; flex-shrink: 0; }
    .atm-panel__row-arrow { color: ${CSS_VARS.muted}; flex-shrink: 0; }
    .atm-panel__row-val {
      font-weight: 500;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .atm-panel__row-del {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      color: ${CSS_VARS.muted};
      padding: 2px 4px;
      border-radius: 4px;
      line-height: 1;
      flex-shrink: 0;
    }
    .atm-panel__row-del:hover { color: #e00; }
    .atm-panel__empty {
      color: ${CSS_VARS.muted};
      padding: 12px 0;
      text-align: center;
      font-size: 12px;
    }
    .atm-panel__form { display: flex; gap: 4px; margin-bottom: 10px; }
    .atm-panel__form input { flex: 1; min-width: 0; }
    .atm-panel__form button { flex-shrink: 0; width: auto; }
    .atm-panel__form input,
    .atm-panel__form button {
      padding: 5px 8px;
      font-size: 12px;
      border: 1px solid ${CSS_VARS.border};
      border-radius: 6px;
      background: ${CSS_VARS.bg};
      color: ${CSS_VARS.fg};
      outline: none;
      font-family: inherit;
    }
    .atm-panel__form input:focus { border-color: ${CSS_VARS.fg}; }
    .atm-panel__form button { cursor: pointer; font-weight: 500; }
    .atm-panel__form button:hover { background: ${CSS_VARS.accent}; }
    .atm-panel__toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: ${CSS_VARS.muted};
      cursor: pointer;
      user-select: none;
    }
    .atm-panel__toggle input { margin: 0; }
    .atm-panel__btn {
      padding: 5px 8px;
      font-size: 12px;
      border: 1px solid ${CSS_VARS.border};
      border-radius: 6px;
      background: ${CSS_VARS.bg};
      color: ${CSS_VARS.fg};
      cursor: pointer;
      font-family: inherit;
      text-align: center;
    }
    .atm-panel__btn:hover { background: ${CSS_VARS.accent}; }

    .atm-fab {
      position: fixed;
      bottom: 16px;
      right: 16px;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 1px solid ${CSS_VARS.border};
      background: ${CSS_VARS.bg};
      color: ${CSS_VARS.fg};
      box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      cursor: pointer;
      z-index: ${Z.fab};
      font-size: 16px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .atm-fab:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.16); }

    .atm-toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: ${CSS_VARS.fg};
      color: ${CSS_VARS.bg};
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      z-index: ${Z.toast};
      box-shadow: 0 4px 12px rgba(0,0,0,0.16);
      opacity: 0;
      transition: opacity 0.15s ease;
      pointer-events: none;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .atm-toast--visible { opacity: 1; }

    @media (prefers-reduced-motion: reduce) {
      .atm-toast { transition: none; }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}