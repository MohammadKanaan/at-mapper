export type UiIconName = "edit" | "delete" | "save" | "cancel";

const ICON_PATHS: Record<UiIconName, string> = {
  edit: "M4 15.5V20h4.5L18.8 9.7l-4.5-4.5L4 15.5Zm17.7-9.8a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-2.4 2.4 4.5 4.5 2.3-2.5Z",
  delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3-9h2v8H9v-8Zm4 0h2v8h-2v-8Zm2.5-6-1-1h-5l-1 1H5v2h14V4h-3.5Z",
  save: "m9.2 16.2-4.4-4.4-1.4 1.4L9.2 19 21 7.2l-1.4-1.4L9.2 16.2Z",
  cancel: "m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z",
};

export function createUiIcon(name: UiIconName): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "ui-button__icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.appendChild(path);
  return svg;
}
