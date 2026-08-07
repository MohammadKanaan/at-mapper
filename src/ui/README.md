# Portable UI layer

This directory contains the framework-free visual primitives used by @-Mapper. It has no browser-extension, storage, or application-state dependencies and can be copied directly into another browser project.

## Use it

Copy `src/ui/` into the target project, then load the CSS entrypoint:

```css
@import url("./ui/styles/index.css");
```

Import the optional TypeScript DOM helpers when rendering controls dynamically:

```ts
import { createUiButton } from "./ui/index.js";

const removeButton = createUiButton({
  label: "Remove item",
  variant: "icon",
  density: "compact",
  icon: "delete",
});
```

Static markup can use the same classes without JavaScript:

```html
<button class="ui-button ui-button--primary">Save</button>

<label class="ui-switch">
  <input type="checkbox" />
  <span class="ui-switch__track" aria-hidden="true"></span>
</label>

<div class="ui-field">
  <label for="name">Name</label>
  <input class="ui-input" id="name" type="text" />
</div>
```

Add `--compact` to buttons, inputs, switches, list rows, and empty states when space is constrained. Available button variants are `primary`, `secondary`, `ghost`, `danger`, `success`, and `icon`.

## Restyle it

Override semantic custom properties after importing the entrypoint. Unlayered project styles take precedence over the UI layer:

```css
:root {
  --ui-color-accent: #3157d5;
  --ui-color-accent-hover: #2444ad;
  --ui-color-accent-soft: #e7edff;
  --ui-color-on-accent: #ffffff;
  --ui-font-sans: Inter, system-ui, sans-serif;
  --ui-radius-control: 6px;
  --ui-shadow-raised: 0 12px 30px rgb(29 42 68 / 14%);
}
```

The default theme responds to `prefers-color-scheme`. Set `data-theme="light"` or `data-theme="dark"` on the document element to force a theme.

## State and accessibility

- Use native `disabled`, `hidden`, `aria-selected`, and `aria-invalid` attributes for state.
- Associate validation messages with inputs through `aria-describedby`.
- Icon-only buttons created by `createUiButton` receive an accessible name from `label` or `ariaLabel`.
- Use `ui-visually-hidden` for labels that should remain available to assistive technology.
