import test from "node:test";
import assert from "node:assert/strict";

// ── Mock browser storage API ────────────────────────────────────
// storage.ts imports `b` from browser.ts. We need to set up the global
// before importing storage.js. The chain is:
//   storage.ts → browser.ts → reads g.__atm_chrome / g.chrome / g.browser

function createMockStorage() {
  const store = {};
  return {
    local: {
      get(key) { return Promise.resolve(key in store ? { [key]: store[key] } : {}); },
      set(obj) { Object.assign(store, obj); return Promise.resolve(); },
    },
    sync: {
      get(key) { return Promise.resolve(key in store ? { [key]: store[key] } : {}); },
      set(obj) { Object.assign(store, obj); return Promise.resolve(); },
    },
    onChanged: {
      addListener() {},
      removeListener() {},
    },
    _store: store,
  };
}

// Inject mock chrome global before loading storage module
const mockStorage = createMockStorage();
globalThis.chrome = { storage: mockStorage };
globalThis.__atm_chrome = { storage: mockStorage };

const storage = await import("../dist/storage.js");

// ── Tests ───────────────────────────────────────────────────────

test("loadMappings returns empty object when nothing stored", async () => {
  // Clear the store
  for (const k of Object.keys(mockStorage._store)) delete mockStorage._store[k];
  const m = await storage.loadMappings();
  assert.deepEqual(m, {});
});

test("saveMappings then loadMappings round-trips", async () => {
  const data = { hello: "world", foo: "bar" };
  await storage.saveMappings(data);
  const loaded = await storage.loadMappings();
  assert.deepEqual(loaded, data);
});

test("loadSettings returns defaults when nothing stored", async () => {
  for (const k of Object.keys(mockStorage._store)) delete mockStorage._store[k];
  const s = await storage.loadSettings();
  assert.equal(s.trigger, "@");
  assert.equal(s.caseSensitive, false);
  assert.equal(s.globalEnabledByDefault, true);
  assert.equal(s.theme, "auto");
});

test("saveSettings then loadSettings round-trips", async () => {
  const s = { trigger: "#", caseSensitive: true, globalEnabledByDefault: false, theme: "dark" };
  await storage.saveSettings(s);
  const loaded = await storage.loadSettings();
  assert.deepEqual(loaded, s);
});

test("loadSettings merges partial saved settings with defaults", async () => {
  // Simulate partial settings stored (e.g. from an older version)
  mockStorage._store["atm_settings"] = { trigger: "/" };
  // Clear the sync key
  const syncStore = mockStorage._store;
  // Directly set partial data in the store
  syncStore["atm_settings"] = { trigger: "/" };
  const loaded = await storage.loadSettings();
  assert.equal(loaded.trigger, "/");
  assert.equal(loaded.caseSensitive, false); // default
  assert.equal(loaded.globalEnabledByDefault, true); // default
  assert.equal(loaded.theme, "auto"); // default
});

test("loadSiteOverrides returns empty when nothing stored", async () => {
  for (const k of Object.keys(mockStorage._store)) delete mockStorage._store[k];
  const o = await storage.loadSiteOverrides();
  assert.deepEqual(o, {});
});

test("saveSiteOverrides then loadSiteOverrides round-trips", async () => {
  const o = { "example.com": true, "test.org": false };
  await storage.saveSiteOverrides(o);
  const loaded = await storage.loadSiteOverrides();
  assert.deepEqual(loaded, o);
});

test("buildExportPayload includes all data", async () => {
  await storage.saveMappings({ a: "1" });
  await storage.saveSettings({ trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "light" });
  await storage.saveSiteOverrides({ "x.com": true });

  const payload = await storage.buildExportPayload();
  assert.equal(payload.version, 1);
  assert.deepEqual(payload.mappings, { a: "1" });
  assert.deepEqual(payload.settings.trigger, "@");
  assert.deepEqual(payload.siteOverrides, { "x.com": true });
});

test("applyImport merge mode merges mappings", async () => {
  await storage.saveMappings({ existing: "old" });

  const payload = {
    version: 1,
    mappings: { new_key: "new_val" },
    settings: { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "auto" },
    siteOverrides: {},
  };
  const result = await storage.applyImport(payload, "merge");
  assert.equal(result.ok, true);

  const m = await storage.loadMappings();
  assert.equal(m.existing, "old");
  assert.equal(m.new_key, "new_val");
});

test("applyImport merge mode overwrites same key with imported value", async () => {
  await storage.saveMappings({ shared: "original" });

  const payload = {
    version: 1,
    mappings: { shared: "updated" },
    settings: { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "auto" },
    siteOverrides: {},
  };
  const result = await storage.applyImport(payload, "merge");
  assert.equal(result.ok, true);

  const m = await storage.loadMappings();
  assert.equal(m.shared, "updated");
});

test("applyImport replace mode replaces all data", async () => {
  await storage.saveMappings({ old: "data" });
  await storage.saveSiteOverrides({ "old.com": true });

  const payload = {
    version: 1,
    mappings: { fresh: "start" },
    settings: { trigger: "#", caseSensitive: true, globalEnabledByDefault: false, theme: "dark" },
    siteOverrides: { "new.com": false },
  };
  const result = await storage.applyImport(payload, "replace");
  assert.equal(result.ok, true);

  const m = await storage.loadMappings();
  assert.deepEqual(m, { fresh: "start" });

  const s = await storage.loadSettings();
  assert.equal(s.trigger, "#");

  const o = await storage.loadSiteOverrides();
  assert.deepEqual(o, { "new.com": false });
});

test("applyImport rejects wrong version", async () => {
  const payload = { version: 99, mappings: {}, settings: {}, siteOverrides: {} };
  const result = await storage.applyImport(payload, "merge");
  assert.equal(result.ok, false);
  assert.match(result.error, /version/i);
});

test("applyImport rejects null payload", async () => {
  const result = await storage.applyImport(null, "merge");
  assert.equal(result.ok, false);
});

test("applyImport rejects non-object payload", async () => {
  const result = await storage.applyImport("not an object", "merge");
  assert.equal(result.ok, false);
});

test("applyImport rejects payload with invalid mappings", async () => {
  const result = await storage.applyImport({ version: 1, mappings: "oops" }, "merge");
  assert.equal(result.ok, false);
  assert.match(result.error, /mappings/i);
});

test("applyImport handles missing settings/siteOverrides gracefully", async () => {
  const payload = { version: 1, mappings: { a: "1" } };
  const result = await storage.applyImport(payload, "merge");
  assert.equal(result.ok, true);
});

test("applyImport reports imported counts", async () => {
  for (const k of Object.keys(mockStorage._store)) delete mockStorage._store[k];
  const payload = {
    version: 1,
    mappings: { a: "1", b: "2", c: "3" },
    settings: { trigger: "@", caseSensitive: false, globalEnabledByDefault: true, theme: "auto" },
    siteOverrides: { "x.com": true, "y.com": false },
  };
  const result = await storage.applyImport(payload, "merge");
  assert.equal(result.ok, true);
  assert.equal(result.imported.mappings, 3);
  assert.equal(result.imported.siteOverrides, 2);
});
