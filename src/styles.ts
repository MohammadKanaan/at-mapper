import type { Theme } from "./types.js";

export const STYLE_ID = "atm-styles";
export const THEME_STYLE_ID = "atm-styles-theme";

export const CSS_VARS = {
  bg: "var(--ui-color-surface)",
  surface: "var(--ui-color-surface-raised)",
  fg: "var(--ui-color-text)",
  muted: "var(--ui-color-text-muted)",
  border: "var(--ui-color-border)",
  accent: "var(--ui-color-accent)",
  accentSoft: "var(--ui-color-accent-soft)",
};

export const Z = { popup: 99999, toast: 99996 };

export const POPUP_MAX_HEIGHT = 280;
export const POPUP_GAP = 8;
export const POPUP_ID = "atm-popup";

const DARK_CSS = `
  .atm-popup {
    --ui-color-surface: #28231f;
    --ui-color-surface-raised: #302a25;
    --ui-color-text: #f3ebe2;
    --ui-color-text-muted: #b8aa9c;
    --ui-color-border: #4b423a;
    --ui-color-accent: #ee9c55;
    --ui-color-accent-soft: #4a3020;
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.38);
  }
  .atm-toast {
    --ui-color-surface: #302a25;
    --ui-color-text: #f3ebe2;
    --ui-color-border: #65584d;
  }
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .atm-popup {
      --ui-color-surface: var(--atm-background, #fffaf4);
      --ui-color-surface-raised: var(--atm-surface, #fffdf9);
      --ui-color-text: var(--atm-foreground, #2b2520);
      --ui-color-text-muted: var(--atm-muted, #6d6257);
      --ui-color-border: var(--atm-border, #ddd1c3);
      --ui-color-accent: var(--atm-accent, #b45414);
      --ui-color-accent-soft: var(--atm-accent-soft, #f8e5d5);
      position: fixed;
      z-index: ${Z.popup};
      box-sizing: border-box;
      width: min(320px, calc(100vw - ${POPUP_GAP * 2}px));
      min-width: min(220px, calc(100vw - ${POPUP_GAP * 2}px));
      max-height: ${POPUP_MAX_HEIGHT}px;
      padding: 5px;
      overflow-y: auto;
      color: ${CSS_VARS.fg};
      background: ${CSS_VARS.bg};
      border: 1px solid ${CSS_VARS.border};
      border-radius: 12px;
      box-shadow: 0 16px 42px rgba(58, 40, 24, 0.2);
      font-family: "Avenir Next", Avenir, "Segoe UI Variable", "Segoe UI", Helvetica, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }

    .atm-popup *,
    .atm-popup *::before,
    .atm-popup *::after {
      box-sizing: border-box;
    }

    .atm-popup__item,
    .atm-popup__add {
      min-height: 42px;
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 9px 10px;
      border-radius: 8px;
      cursor: pointer;
      transition: background 150ms ease;
    }

    .atm-popup__item:hover,
    .atm-popup__item[aria-selected="true"],
    .atm-popup__add:hover,
    .atm-popup__add[aria-selected="true"] {
      background: ${CSS_VARS.accentSoft};
    }

    .atm-popup__key {
      max-width: 42%;
      flex: 0 1 auto;
      overflow: hidden;
      color: ${CSS_VARS.accent};
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .atm-popup__val {
      min-width: 0;
      flex: 1;
      overflow: hidden;
      color: ${CSS_VARS.fg};
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .atm-popup__add {
      margin-top: 4px;
      color: ${CSS_VARS.muted};
      border-top: 1px solid ${CSS_VARS.border};
      border-radius: 0 0 8px 8px;
      font-size: 12px;
      font-weight: 600;
    }

    .atm-popup__add-form {
      display: flex;
      padding: 8px;
      margin-top: 4px;
      border-top: 1px solid ${CSS_VARS.border};
    }

    .atm-popup__add-form input {
      width: 100%;
      min-width: 0;
      min-height: 38px;
      padding: 8px 10px;
      color: ${CSS_VARS.fg};
      background: ${CSS_VARS.surface};
      border: 1px solid ${CSS_VARS.border};
      border-radius: 8px;
      outline: none;
      font: inherit;
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .atm-popup__add-form input:focus {
      border-color: ${CSS_VARS.accent};
      box-shadow: 0 0 0 3px color-mix(in srgb, ${CSS_VARS.accent} 24%, transparent);
    }

    .atm-toast {
      --ui-color-surface: var(--atm-background, #2b2520);
      --ui-color-text: var(--atm-foreground, #fffaf4);
      --ui-color-border: var(--atm-border, #4b423a);
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: ${Z.toast};
      max-width: min(360px, calc(100vw - 32px));
      padding: 10px 14px;
      color: var(--ui-color-text);
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: 10px;
      box-shadow: 0 12px 32px rgba(43, 37, 32, 0.24);
      opacity: 0;
      pointer-events: none;
      transform: translateY(8px);
      transition: opacity 180ms ease, transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
      font-family: "Avenir Next", Avenir, "Segoe UI Variable", "Segoe UI", Helvetica, sans-serif;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }

    .atm-toast--visible {
      opacity: 1;
      transform: translateY(0);
    }

    @media (prefers-color-scheme: dark) {
      html:not([data-atm-theme="light"]) {
        ${DARK_CSS}
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .atm-popup *,
      .atm-toast {
        transition-duration: 0.01ms !important;
      }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

export function applyContentTheme(theme: Theme): void {
  const html = document.documentElement;

  if (theme === "auto") {
    html.removeAttribute("data-atm-theme");
    removeThemeStyle();
    return;
  }

  if (theme === "light") {
    html.setAttribute("data-atm-theme", "light");
    removeThemeStyle();
    return;
  }

  html.setAttribute("data-atm-theme", "dark");
  injectDarkOverride();
}

function injectDarkOverride(): void {
  if (document.getElementById(THEME_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = THEME_STYLE_ID;
  style.textContent = DARK_CSS;
  (document.head || document.documentElement).appendChild(style);
}

function removeThemeStyle(): void {
  document.getElementById(THEME_STYLE_ID)?.remove();
}
