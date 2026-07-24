# @-Mapper Extension

Cross-browser (Chrome + Firefox) WebExtension that converts `@word` into a
configured replacement via an autocomplete dropdown — on **any** website with
an editable field. Manage mappings, toggle per-site, and export/import.

Converted from the original `at-mapping.user.js` (Memos-only userscript).

## Build

Requires Node 18+.

```bash
npm install
npm run build
```

This compiles `src/**/*.ts` → `dist/` via `tsc`, generates icons, and copies the
manifest + HTML/CSS into `dist/`. The `dist/` folder is the loadable extension.

## Load unpacked

### Chrome / Edge / Brave (Chromium)
1. Visit `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `dist/` folder

### Firefox
1. Visit `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `dist/manifest.json`

## Usage

- Type `@word` in a text input, textarea, or contenteditable editor → a dropdown of
  matching mappings appears. Arrow keys navigate, Enter/Tab applies, Escape closes.
- The toolbar popup lets you add, search, edit, and remove mappings, toggle the
  current site, switch appearance, and quickly import or export your data.
- The settings page manages global defaults, appearance, the trigger character,
  case sensitivity, per-site overrides, and full merge/replace imports.

## Export / Import

Export produces a JSON payload:

```json
{
  "version": 1,
  "mappings": { "key": "replacement", "...": "..." },
  "settings": { "trigger": "@", "caseSensitive": false, "globalEnabledByDefault": true, "theme": "auto" },
  "siteOverrides": { "example.com": false }
}
```

Import offers two modes: **Merge** (add/overwrite keys into existing data) and
**Replace** (wipe and replace everything).

## Storage

- `chrome.storage.local` → mappings (up to ~10 MB)
- `chrome.storage.sync`  → settings + per-site overrides (roams across devices)
