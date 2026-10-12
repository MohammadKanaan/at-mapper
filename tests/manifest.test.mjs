import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, posix, resolve } from "node:path";

const dist = resolve(import.meta.dirname, "..", "dist");
const IMPORT_RE = /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g;

/** Collect every module reachable from `entry` via relative imports (dist-relative paths). */
function collectModules(entry, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const source = readFileSync(resolve(dist, entry), "utf8");
  for (const [, spec] of source.matchAll(IMPORT_RE)) {
    collectModules(posix.normalize(posix.join(dirname(entry), spec)), seen);
  }
  return seen;
}

test("every module imported by the content script is web-accessible", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(dist, "manifest.json"), "utf8"),
  );
  const accessible = new Set(
    manifest.web_accessible_resources.flatMap((r) => r.resources),
  );
  const missing = [...collectModules("content.js")].filter(
    (m) => !accessible.has(m),
  );
  assert.deepEqual(missing, []);
});

test("manifest declares the AMO data collection consent", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(dist, "manifest.json"), "utf8"),
  );
  const gecko = manifest.browser_specific_settings?.gecko;
  assert.ok(
    gecko,
    "browser_specific_settings.gecko is required to publish on AMO",
  );
  // AMO refuses new submissions that omit this key. @mapper transmits nothing,
  // and "none" cannot be combined with any other data type.
  assert.deepEqual(gecko.data_collection_permissions, { required: ["none"] });
});
