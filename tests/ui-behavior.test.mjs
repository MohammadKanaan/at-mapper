import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import * as mappings from "../dist/shared/mappings.js";
import * as popup from "../dist/autocomplete/popup.js";

test("mapping empty-state copy distinguishes an empty library from an empty search", () => {
  assert.equal(
    mappings.getMappingEmptyMessage(0, ""),
    "No mappings yet. Add your first shortcut above.",
  );
  assert.equal(
    mappings.getMappingEmptyMessage(3, "invoice"),
    'No matches for "invoice".',
  );
});

test("new mapping validation rejects missing values and duplicate shortcuts", () => {
  const current = { invoice: "Invoice details" };
  assert.equal(
    mappings.getNewMappingError(current, "", "Replacement", "@"),
    "Enter both a shortcut and replacement.",
  );
  assert.equal(
    mappings.getNewMappingError(current, "invoice", "Updated details", "@"),
    "@invoice already exists.",
  );
  assert.equal(
    mappings.getNewMappingError(current, "summary", "Summary text", "@"),
    null,
  );
});

test("autocomplete popup stays inside narrow viewports", () => {
  assert.equal(popup.clampPopupLeft(-12, 180, 220, 8), 8);
  assert.equal(popup.clampPopupLeft(170, 180, 220, 8), 8);
  assert.equal(popup.clampPopupLeft(280, 360, 220, 8), 132);
  assert.equal(popup.clampPopupLeft(48, 360, 220, 8), 48);
});

test("options controls keep the select chevron inset and separate mapping rows", async () => {
  const [css, components] = await Promise.all([
    readFile(new URL("../src/options/options.css", import.meta.url), "utf8"),
    readFile(new URL("../src/ui/styles/components.css", import.meta.url), "utf8"),
  ]);

  assert.match(components, /\.ui-select[\s\S]*?appearance:\s*none/);
  assert.match(components, /background-image:\s*var\(--ui-select-chevron\)/);
  assert.match(components, /background-position:\s*right 16px center/);
  assert.match(css, /#panel-mappings \.add-row\s*\{[\s\S]*?margin-top:\s*18px/);
});

test("popup and options consume the portable UI stylesheet", async () => {
  const uiIndexUrl = new URL("../src/ui/styles/index.css", import.meta.url);
  const builtUiIndexUrl = new URL("../dist/ui/styles/index.css", import.meta.url);

  assert.equal(existsSync(uiIndexUrl), true, "source UI stylesheet entrypoint should exist");
  assert.equal(existsSync(builtUiIndexUrl), true, "build should copy the UI stylesheet entrypoint");

  const [popupCss, optionsCss, uiCss] = await Promise.all([
    readFile(new URL("../src/popup/popup.css", import.meta.url), "utf8"),
    readFile(new URL("../src/options/options.css", import.meta.url), "utf8"),
    readFile(uiIndexUrl, "utf8"),
  ]);

  assert.match(popupCss, /@import\s+"\.\.\/ui\/styles\/index\.css"/);
  assert.match(optionsCss, /@import\s+"\.\.\/ui\/styles\/index\.css"/);
  assert.doesNotMatch(popupCss, /(?:^|\n):root\s*\{/);
  assert.doesNotMatch(optionsCss, /(?:^|\n):root\s*\{/);
  assert.match(uiCss, /tokens\.css/);
  assert.match(uiCss, /foundation\.css/);
  assert.match(uiCss, /components\.css/);
});

test("portable UI exposes semantic tokens and reusable component selectors", async () => {
  const tokensUrl = new URL("../src/ui/styles/tokens.css", import.meta.url);
  const componentsUrl = new URL("../src/ui/styles/components.css", import.meta.url);
  assert.equal(existsSync(tokensUrl), true, "semantic token stylesheet should exist");
  assert.equal(existsSync(componentsUrl), true, "shared component stylesheet should exist");

  const [tokens, components] = await Promise.all([
    readFile(tokensUrl, "utf8"),
    readFile(componentsUrl, "utf8"),
  ]);

  for (const token of [
    "--ui-color-canvas",
    "--ui-color-surface",
    "--ui-color-text",
    "--ui-color-accent",
    "--ui-radius-control",
    "--ui-shadow-raised",
    "--ui-focus-ring",
  ]) {
    assert.match(tokens, new RegExp(token));
  }

  for (const selector of [
    ".ui-button",
    ".ui-field",
    ".ui-switch",
    ".ui-badge",
    ".ui-list-row",
    ".ui-empty-state",
    ".ui-notice",
    ".ui-visually-hidden",
  ]) {
    assert.match(components, new RegExp(selector.replace(".", "\\.")));
  }

  assert.match(components, /\.ui-button--compact/);
  assert.match(components, /\[aria-invalid="true"\]/);
});

test("portable switch establishes its own standalone layout box", async () => {
  const components = await readFile(
    new URL("../src/ui/styles/components.css", import.meta.url),
    "utf8",
  );

  assert.match(components, /\.ui-switch\s*\{[\s\S]*?display:\s*inline-block/);
});

test("portable DOM helpers create accessible icon buttons", async () => {
  const builtUiUrl = new URL("../dist/ui/index.js", import.meta.url);
  assert.equal(existsSync(builtUiUrl), true, "compiled UI TypeScript entrypoint should exist");

  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.attributes = new Map();
      this.children = [];
      this.className = "";
      this.textContent = "";
      this.title = "";
      this.type = "";
    }

    setAttribute(name, value) {
      this.attributes.set(name, value);
    }

    append(...children) {
      this.children.push(...children);
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }
  }

  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: (tagName) => new FakeElement(tagName),
    createElementNS: (_namespace, tagName) => new FakeElement(tagName),
  };

  try {
    const { createUiButton } = await import(builtUiUrl);
    const button = createUiButton({
      label: "Delete @invoice",
      variant: "icon",
      density: "compact",
      icon: "delete",
      title: "Delete mapping",
    });

    assert.equal(button.type, "button");
    assert.equal(button.className, "ui-button ui-button--icon ui-button--compact");
    assert.equal(button.attributes.get("aria-label"), "Delete @invoice");
    assert.equal(button.title, "Delete mapping");
    assert.equal(button.children[0].tagName, "svg");
    assert.equal(button.children[0].attributes.get("aria-hidden"), "true");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("injected UI uses scoped semantic tokens without global UI selectors", async () => {
  const styles = await readFile(new URL("../src/styles.ts", import.meta.url), "utf8");

  assert.match(styles, /\.atm-popup\s*\{[\s\S]*?--ui-color-surface:/);
  assert.match(styles, /\.atm-toast\s*\{[\s\S]*?--ui-color-text:/);
  assert.match(styles, /var\(--ui-color-accent\)/);
  assert.doesNotMatch(styles, /(?:^|\n)\s*:root\s*\{/);
  assert.doesNotMatch(styles, /(?:^|\n)\s*\.ui-(?:button|field|switch|badge|list-row)/);
});
