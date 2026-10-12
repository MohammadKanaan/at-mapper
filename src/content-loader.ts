// MV3 content scripts are classic scripts and cannot use static `import`.
// This bootstrap uses dynamic import() of the extension resource URL so the
// module (and all its static imports) load in the content-script isolated world.
// We stash the content-script `chrome` global on `globalThis` so the module's
// browser shim can access chrome.storage even though dynamic-import modules
// may execute in a realm where the main-world `chrome` is visible instead.
//
// The specifier is inlined instead of being held in a variable: addons-linter
// reports `import(someVariable)` as UNSAFE_VAR_ASSIGNMENT, an AMO warning about
// dynamic values that "have not been adequately sanitized". The argument is the
// literal resource name "content.js" resolved against the extension origin, so
// it can never point at remote code.
(globalThis as unknown as { __atm_chrome?: typeof chrome }).__atm_chrome =
  chrome;
import(chrome.runtime.getURL("content.js")).catch((e) =>
  console.error("[@mapper] failed to load content module", e),
);
