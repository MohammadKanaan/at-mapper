# Chrome Web Store listing for @mapper

Copy for the Chrome Web Store submission form. Paste each block into the field
it belongs to. Character limits are noted where the store sets one.

## Store listing

Extension name, max 75 characters

```
@mapper
```

Summary, max 132

```
Turn @word into your saved text in any field. Autocomplete shortcuts, per-site control, and import/export.
```

Category

```
Productivity
```

Language

```
English (United States)
```

Homepage URL, optional

```
https://github.com/MohammadKanaan/at-mapper
```

Support URL

```
https://github.com/MohammadKanaan/at-mapper/issues
```

## Detailed description

```
@mapper turns short triggers like @sig into saved text, anywhere you can type.

Type a trigger, pick from a menu of your own shortcuts, and the text lands where the caret is. Use it for signatures, addresses, canned replies, emoji, or code snippets.

How it works
Type your trigger, @ by default, then a few letters. A menu opens next to the caret with the matching replacements. Press Enter to insert the highlighted one, use the arrow keys to pick another, or press Escape to close it. If nothing matches, the menu offers to save the new shortcut without leaving the page.

What you can do
- Use shortcuts in text inputs, textareas, and rich-text editors on any site.
- Choose your own trigger character, and match keys with or without case.
- Add, edit, search, and delete mappings from the toolbar popup.
- Add a mapping inline while you are still writing.
- Turn the extension on or off globally, and override it per site.
- Export mappings to a JSON file and import them in another browser.
- Pick a light or dark theme, or follow your system.

Privacy
Mappings stay on your device in the browser's extension storage. Settings and per-site overrides use sync storage, so your browser can carry them to your other devices if you have sync on. @mapper has no account, no analytics, and makes no network requests.

Permissions
- storage: saves your mappings and settings.
- Access to all sites. The autocomplete menu has to work in any editable field you use. @mapper reads only the field you are typing in, not the rest of the page.

@mapper is free and MIT licensed.
```

## Privacy practices, the store's Privacy tab

Single purpose

```
@mapper inserts user-defined replacement text into editable fields when the user types a trigger character, and lets the user manage those replacements, settings, and per-site behavior.
```

Permission justifications

| Permission | Justification |
| --- | --- |
| `storage` | Saves the user's shortcut mappings locally and their settings and per-site overrides in synchronized extension storage. The extension's only feature depends on it. |
| Host permission, `<all_urls>` | The content script has to detect the trigger character in editable fields on whatever site the user writes in. Without it, the autocomplete menu cannot appear. The extension watches only the editable field being typed in, not other page content. |

Data usage

- Does the extension collect or use personal data? No.
- Is data sold to third parties? No.
- Is data used or transferred for purposes unrelated to the item's single purpose? No.
- Is data used or transferred to determine creditworthiness or for lending? No.
- Does the extension's data use comply with the Chrome Web Store User Data Policy, including the Limited Use requirements? Yes.
- The extension ships no remote code.

Privacy policy URL

The policy ships in the repository at `PRIVACY.html`. Host it at a public URL
and paste that URL here, for example a GitHub Pages URL. The store will not
accept a local file path.

## Graphic assets

Upload from this directory. The store accepts PNG or JPEG. Every file below is
an opaque PNG at the exact size the store asks for.

| Field | File | Size |
| --- | --- | --- |
| Store icon | `icons/icon-128.png` | 128x128 |
| Screenshot 1 | `store/screenshots/01-autocomplete.png` | 1280x800 |
| Screenshot 2 | `store/screenshots/02-inline-add.png` | 1280x800 |
| Screenshot 3 | `store/screenshots/03-popup.png` | 1280x800 |
| Screenshot 4 | `store/screenshots/04-mappings.png` | 1280x800 |
| Screenshot 5 | `store/screenshots/05-sites.png` | 1280x800 |
| Small promo tile | `store/promo/small-tile-440x280.png` | 440x280 |
| Marquee promo tile | `store/promo/marquee-1400x560.png` | 1400x560 |

Screenshot order and what each one shows

1. `01-autocomplete.png` shows the trigger menu completing a shortcut in a real text field.
2. `02-inline-add.png` shows saving a new shortcut inline, without leaving the page.
3. `03-popup.png` shows the toolbar popup: the mappings list, search, and the site toggle.
4. `04-mappings.png` shows Settings, Mappings: create, edit, search, and delete.
5. `05-sites.png` shows Settings, Sites: per-site enable and disable overrides.

The small promo tile appears on the item's store listing. The marquee is
optional and used for featured placements.
