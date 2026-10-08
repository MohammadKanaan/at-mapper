# Store marketing material

Assets and copy for the Chrome Web Store listing. Everything here is ready to
upload. See [`listing.md`](listing.md) for the text that goes in each field and
the order the screenshots should appear in.

```
store/
├── listing.md                      copy, permission justifications, asset checklist
├── screenshots/
│   ├── 01-autocomplete.png         1280x800  shortcut menu in a live text field
│   ├── 02-inline-add.png           1280x800  saving a new shortcut inline
│   ├── 03-popup.png                1280x800  the toolbar popup, staged
│   ├── 04-mappings.png             1280x800  Settings, Mappings
│   └── 05-sites.png                1280x800  Settings, Sites
└── promo/
    ├── small-tile-440x280.png      store listing tile
    └── marquee-1400x560.png        featured placement banner
```

All images are 24-bit PNG with no transparency, at the store's required sizes.

## How the screenshots were made

They are real captures, not mockups. A headed Chromium session loads the
unpacked build from `dist/` with `--load-extension`, seeds a few shortcuts, and
drives the real UI: the content-script menu, the inline add form, the toolbar
popup, and the settings tabs. The captured browser surface is either written
straight out, which are `01`, `02`, `04`, and `05`, or staged on a flat
backdrop built from the app's own tokens, which are `03` and the two promo
tiles.

Regenerate after any UI change:

```bash
bun run build
bun run make-store
```

The script checks that every output is the exact size and has no alpha channel.

### Requirements

- A headed display. Chromium does not load unpacked extensions in headless
  mode.
- A Playwright install whose Chromium build is present. The script looks in the
  project, in global npm, in bun, and in npx caches, then picks the first copy
  whose `chromium.executablePath()` exists. If none works:

  ```bash
  npx playwright install chromium
  ```

  Or point the script at one directly:

  ```bash
  PLAYWRIGHT_PACKAGE=/path/to/playwright-core node scripts/capture-store-assets.mjs
  ```

The fixtures and staging pages live in
[`scripts/capture/`](../scripts/capture/): `editor-fixture.html` is a neutral
writing surface for the content-script shots, plus `stage-popup.html` and
`promo.html` for the composed assets.

## Submission checklist

- [ ] `bun run build` and `bun run test` pass.
- [ ] Upload `icons/icon-128.png` as the store icon.
- [ ] Upload `screenshots/01` through `05` in numeric order.
- [ ] Upload `promo/small-tile-440x280.png`, and the marquee if featured.
- [ ] Paste the listing copy from `listing.md`.
- [ ] Host `PRIVACY.html` at a public URL and paste it into the privacy policy
      field.
- [ ] Fill in the privacy practices answers from `listing.md`.
