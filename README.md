# @-Mapper

@-Mapper is a cross-browser WebExtension that expands shortcuts such as `@word` into saved text from an autocomplete menu. It supports text inputs, textareas, and contenteditable editors on regular web pages.

## Features

- Configurable trigger character and case-sensitive matching
- Keyboard navigation, inline mapping creation, and replacement
- Mapping management, import, and export
- Global enabled setting with per-hostname overrides
- Light, dark, and system appearance modes

## Requirements

- Bun, and Node.js 18+ (the test runner uses `node --test`)
- A Chromium-based browser (Chrome, Edge, Brave, etc.) or Firefox 121+

## Install and build

Install dependencies, then build the default Chromium package:

```bash
bun install --frozen-lockfile
bun run build
```

The loadable extension is generated in `dist/`.

For local development:

```bash
bun run watch      # Recompile TypeScript on changes
bun run typecheck  # Check types without writing dist/
bun run test       # Build, then run the Node test suite
```

Run `bun run build` after changing static assets or the manifest.

## Load the extension

### Chrome, Edge, Brave, and other Chromium browsers

1. Open `chrome://extensions` (or your browser's extensions page).
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select this project's `dist/` directory.

### Firefox

Build the Firefox-compatible package first:

```bash
bun run build:firefox
```

Then:

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on…**.
3. Choose `dist/manifest.json`.

Temporary add-ons are removed when Firefox restarts.

## Export and import

Exports are JSON files with mappings, settings, and hostname overrides:

```json
{
  "version": 1,
  "mappings": { "word": "replacement word", "...": "..." },
  "settings": {
    "trigger": "@",
    "caseSensitive": false,
    "globalEnabledByDefault": true,
    "theme": "auto"
  },
  "siteOverrides": { "example.com": false }
}
```

Import supports **Merge** (add or overwrite matching keys) and **Replace**
(replace all stored data).

## Storage and permissions

- Mappings are saved in the browser's local WebExtension storage.
- Settings and hostname overrides are saved in synchronized WebExtension storage, when the browser supports sync.
- The extension requests access to all URLs so autocomplete can run in editable fields across websites; it can be disabled globally or per site.
