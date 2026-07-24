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

- Type `@word` in any textarea or contenteditable editor → a dropdown of
  matching mappings appears. Arrow keys navigate, Enter/Tab applies, Escape closes.
- The floating **@** button (bottom-right) opens a side panel to add/view/delete mappings.
- The toolbar popup lets you toggle the extension for the current site in one click.
- The options page (full tab) manages global defaults, trigger character,
  case-sensitivity, per-site list, and export/import of mappings.

## Export / Import

Export produces a JSON payload:

```json
{
  "version": 1,
  "mappings": { "key": "replacement", "...": "..." },
  "settings": { "trigger": "@", "caseSensitive": false, "fabEnabled": true, "globalEnabledByDefault": true },
  "siteOverrides": { "example.com": false }
}
```

Import offers two modes: **Merge** (add/overwrite keys into existing data) and
**Replace** (wipe and replace everything).

## Storage

- `chrome.storage.local` → mappings (up to ~10 MB)
- `chrome.storage.sync`  → settings + per-site overrides (roams across devices)