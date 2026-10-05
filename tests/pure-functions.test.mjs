import test from "node:test";
import assert from "node:assert/strict";

import { stripAt } from "../dist/shared/text.js";
import {
  filterAndSortMappings,
  getNewMappingError,
  formatMappingShortcut,
  validateMappingKey,
} from "../dist/shared/mappings.js";
import { resolveTheme, themeName, themeLabel } from "../dist/shared/theme.js";
import { isSiteEnabled } from "../dist/host.js";
import { hasMapping, matchingMappings } from "../dist/autocomplete/items.js";

// ── shared/text.ts ──────────────────────────────────────────────

test("stripAt removes leading @ characters", () => {
  assert.equal(stripAt("@word"), "word");
  assert.equal(stripAt("@@@word"), "word");
});

test("stripAt trims whitespace after stripping", () => {
  assert.equal(stripAt("@ word"), "word");
  assert.equal(stripAt("@  word  "), "word");
});

test("stripAt returns empty string for just @", () => {
  assert.equal(stripAt("@"), "");
  assert.equal(stripAt("@@"), "");
  assert.equal(stripAt(""), "");
});

test("stripAt leaves non-@ strings alone", () => {
  assert.equal(stripAt("hello"), "hello");
  assert.equal(stripAt("#tag"), "#tag");
});

// ── shared/mappings.ts — filterAndSortMappings ──────────────────

test("filterAndSortMappings returns all entries sorted when query is empty", () => {
  const m = { zebra: "Z", apple: "A", mango: "M" };
  const result = filterAndSortMappings(m, "");
  assert.deepEqual(result, [
    ["apple", "A"],
    ["mango", "M"],
    ["zebra", "Z"],
  ]);
});

test("filterAndSortMappings filters by key substring (case-insensitive)", () => {
  const m = { invoice: "INV", intro: "INT", sig: "SIG" };
  const result = filterAndSortMappings(m, "inv");
  assert.deepEqual(result, [["invoice", "INV"]]);
});

test("filterAndSortMappings filters by value substring (case-insensitive)", () => {
  const m = { a: "Hello World", b: "Goodbye", c: "hello there" };
  const result = filterAndSortMappings(m, "hello");
  assert.equal(result.length, 2);
  assert.deepEqual(result[0], ["a", "Hello World"]);
  assert.deepEqual(result[1], ["c", "hello there"]);
});

test("filterAndSortMappings returns empty for no matches", () => {
  const result = filterAndSortMappings({ a: "x" }, "zzz");
  assert.deepEqual(result, []);
});

test("filterAndSortMappings handles empty mappings object", () => {
  const result = filterAndSortMappings({}, "");
  assert.deepEqual(result, []);
});

// ── shared/mappings.ts — validateMappingKey ─────────────────────

test("validateMappingKey rejects empty key", () => {
  assert.equal(validateMappingKey("", "old", {}), false);
  assert.equal(validateMappingKey("@", "old", {}), false);
  assert.equal(validateMappingKey("@@", "old", {}), false);
});

test("validateMappingKey accepts valid new key", () => {
  assert.equal(validateMappingKey("newkey", "old", {}), true);
  assert.equal(validateMappingKey("@newkey", "old", {}), true);
});

test("validateMappingKey accepts renaming to same key", () => {
  assert.equal(validateMappingKey("same", "same", { same: "v" }), true);
  assert.equal(validateMappingKey("@same", "same", { same: "v" }), true);
});

test("validateMappingKey rejects collision with existing key", () => {
  assert.equal(validateMappingKey("taken", "old", { taken: "v" }), false);
  assert.equal(validateMappingKey("@taken", "old", { taken: "v" }), false);
});

// ── shared/theme.ts ─────────────────────────────────────────────

test("resolveTheme returns literal for light/dark", () => {
  assert.equal(resolveTheme("light", null), "light");
  assert.equal(resolveTheme("dark", null), "dark");
});

test("resolveTheme defers to MediaQueryList for auto", () => {
  assert.equal(resolveTheme("auto", { matches: true }), "dark");
  assert.equal(resolveTheme("auto", { matches: false }), "light");
  assert.equal(resolveTheme("auto", null), "light");
});

test("themeName returns display names", () => {
  assert.equal(themeName("light"), "Light");
  assert.equal(themeName("dark"), "Dark");
  assert.equal(themeName("auto"), "System");
});

test("themeLabel includes current state", () => {
  assert.equal(themeLabel("auto", "dark"), "System theme, currently dark. Change theme");
  assert.equal(themeLabel("light", "light"), "Light theme, currently light. Change theme");
});

// ── host.ts — isSiteEnabled ─────────────────────────────────────

test("isSiteEnabled returns global default when no override exists", () => {
  const s = { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "auto" };
  assert.equal(isSiteEnabled(s, {}, "example.com"), true);

  const s2 = { ...s, globalEnabledByDefault: false };
  assert.equal(isSiteEnabled(s2, {}, "example.com"), false);
});

test("isSiteEnabled respects per-site override", () => {
  const s = { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "auto" };
  assert.equal(isSiteEnabled(s, { "example.com": false }, "example.com"), false);
  assert.equal(isSiteEnabled(s, { "example.com": true }, "example.com"), true);
});

test("isSiteEnabled returns global default when hostname is empty", () => {
  const s = { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "auto" };
  assert.equal(isSiteEnabled(s, {}, ""), true);

  const s2 = { ...s, globalEnabledByDefault: false };
  assert.equal(isSiteEnabled(s2, {}, ""), false);
});

test("isSiteEnabled returns global default for unoverridden host", () => {
  const s = { trigger: "@", caseSensitive: false, globalEnabledByDefault: false, theme: "auto" };
  assert.equal(isSiteEnabled(s, { "other.com": true }, "example.com"), false);
});

// ── autocomplete/items.ts — hasMapping ──────────────────────────

test("hasMapping case-sensitive exact match", () => {
  assert.equal(hasMapping({ Foo: "bar" }, true, "Foo"), true);
  assert.equal(hasMapping({ Foo: "bar" }, true, "foo"), false);
  assert.equal(hasMapping({ Foo: "bar" }, true, "baz"), false);
});

test("hasMapping case-insensitive match", () => {
  assert.equal(hasMapping({ Foo: "bar" }, false, "foo"), true);
  assert.equal(hasMapping({ Foo: "bar" }, false, "FOO"), true);
  assert.equal(hasMapping({ Foo: "bar" }, false, "Foo"), true);
  assert.equal(hasMapping({ Foo: "bar" }, false, "baz"), false);
});

test("hasMapping uses hasOwnProperty to avoid prototype pollution", () => {
  // "toString" exists on Object.prototype but not as own property
  assert.equal(hasMapping({}, false, "toString"), false);
  assert.equal(hasMapping({}, true, "toString"), false);
});

// ── autocomplete/items.ts — matchingMappings ────────────────────

test("matchingMappings filters by substring (case-sensitive)", () => {
  const m = { abc: "1", Abc: "2", def: "3" };
  const result = matchingMappings(m, true, "ab");
  assert.deepEqual(result, [["abc", "1"]]);
});

test("matchingMappings filters by substring (case-insensitive)", () => {
  const m = { abc: "1", Abc: "2", def: "3" };
  const result = matchingMappings(m, false, "ab");
  assert.equal(result.length, 2);
  assert.deepEqual(result, [["abc", "1"], ["Abc", "2"]]);
});

test("matchingMappings returns sorted results", () => {
  const m = { z: "1", a: "2", m: "3" };
  const result = matchingMappings(m, false, "");
  assert.deepEqual(result, [["a", "2"], ["m", "3"], ["z", "1"]]);
});

test("matchingMappings returns empty for no matches", () => {
  const result = matchingMappings({ a: "1" }, false, "zzz");
  assert.deepEqual(result, []);
});

// ── shared/mappings.ts — getNewMappingError ─────────────────────

test("getNewMappingError rejects empty key or value", () => {
  assert.ok(getNewMappingError({}, "", "val", "@"));
  assert.ok(getNewMappingError({}, "key", "", "@"));
  assert.ok(getNewMappingError({}, "", "", "@"));
});

test("getNewMappingError rejects duplicate key", () => {
  const err = getNewMappingError({ existing: "v" }, "existing", "new", "@");
  assert.equal(err, "@existing already exists.");
});

test("getNewMappingError returns null for valid new mapping", () => {
  assert.equal(getNewMappingError({}, "new", "val", "#"), null);
});

// ── shared/mappings.ts — formatMappingShortcut ──────────────────

test("formatMappingShortcut uses the provided trigger", () => {
  assert.equal(formatMappingShortcut("@", "word"), "@word");
  assert.equal(formatMappingShortcut("#", "tag"), "#tag");
  assert.equal(formatMappingShortcut("/", "cmd"), "/cmd");
});
