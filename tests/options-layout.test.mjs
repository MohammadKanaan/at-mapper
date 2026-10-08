import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");

/**
 * Switching between settings tabs changes how tall the page is. Tall panels
 * (Sites, Mappings) make the document scrollable, which pops in a scrollbar and
 * narrows the centered container — a horizontal UI shift.
 *
 * `scrollbar-gutter: stable` is the modern tool, but it reserves nothing here
 * because foundation.css styles `::-webkit-scrollbar`; forcing the track with
 * `overflow-y: scroll` keeps the content width constant. A real-browser check
 * lives in scripts/verify-options-scrollbar.mjs.
 */
test("settings page keeps the scrollbar track reserved on the root scroller", () => {
  const css = readFileSync(resolve(dist, "options/options.css"), "utf8");
  assert.match(
    css,
    /html\s*\{[^}]*overflow-y:\s*scroll/,
    "options.css should set `overflow-y: scroll` on `html`",
  );
});
