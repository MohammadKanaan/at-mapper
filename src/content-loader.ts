// MV3 content scripts are classic scripts and cannot use static `import`.
// This bootstrap uses dynamic import() of the extension resource URL so the
// module (and all its static imports) load in the content-script isolated world.
// We stash the content-script `chrome` global on `globalThis` so the module's
// browser shim can access chrome.storage even though dynamic-import modules
// may execute in a realm where the main-world `chrome` is visible instead.
(globalThis as unknown as { __atm_chrome?: typeof chrome }).__atm_chrome = chrome;
const url = chrome.runtime.getURL("content.js");
import(url).catch((e) => console.error("[@-Mapper] failed to load content module", e));