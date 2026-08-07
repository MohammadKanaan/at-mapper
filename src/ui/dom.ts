import { createUiIcon, type UiIconName } from "./icons.js";

export type UiButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "icon";
export type UiControlDensity = "default" | "compact";

export interface UiButtonOptions {
  label: string;
  variant?: UiButtonVariant;
  density?: UiControlDensity;
  icon?: UiIconName;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

export function createUiButton(options: UiButtonOptions): HTMLButtonElement {
  const variant = options.variant ?? "secondary";
  const button = document.createElement("button");
  button.type = "button";
  button.className = [
    "ui-button",
    `ui-button--${variant}`,
    options.density === "compact" ? "ui-button--compact" : "",
    options.className ?? "",
  ].filter(Boolean).join(" ");

  if (options.title) button.title = options.title;
  if (variant === "icon" || options.ariaLabel) {
    button.setAttribute("aria-label", options.ariaLabel ?? options.label);
  }

  if (options.icon) button.append(createUiIcon(options.icon));
  if (variant !== "icon") button.append(options.label);
  return button;
}
