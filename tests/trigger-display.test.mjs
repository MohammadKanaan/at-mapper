import test from "node:test";
import assert from "node:assert/strict";

import * as mappings from "../dist/shared/mappings.js";

test("mapping labels use the configured trigger character", () => {
  assert.equal(
    mappings.formatMappingShortcut?.("#", "invoice"),
    "#invoice",
  );
});
