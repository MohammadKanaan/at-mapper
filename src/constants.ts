/** Runtime constants shared across content-script modules. */

/** Trigger character used when the user has not configured one. */
export const DEFAULT_TRIGGER = "@";

/** Delay before hiding the popup on blur, so clicks inside it still register. */
export const BLUR_HIDE_DELAY_MS = 150;

/** How long content-page and popup toasts stay visible. */
export const TOAST_DURATION_MS = 4000;

/** Line height (px) assumed when the computed style has no numeric value. */
export const FALLBACK_LINE_HEIGHT_PX = 18;

/** Popup width (px) assumed before the popup has been laid out. */
export const FALLBACK_POPUP_WIDTH_PX = 220;
