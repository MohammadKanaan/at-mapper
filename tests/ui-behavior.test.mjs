import test from "node:test";
import assert from "node:assert/strict";
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
  const css = await readFile(new URL("../src/options/options.css", import.meta.url), "utf8");

  assert.match(css, /\.select-field select[\s\S]*?appearance:\s*none/);
  assert.match(css, /background-position:\s*right 16px center/);
  assert.match(css, /#panel-mappings \.add-row\s*\{[\s\S]*?margin-top:\s*18px/);
});
