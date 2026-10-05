/**
 * Minimal cross-browser API shim.
 *
 * Firefox MV3 exposes both `chrome.*` (callback-style) and `browser.*`
 * (promise-native). Chrome exposes only `chrome.*`, but in MV3 all async
 * APIs return Promises, so `chrome.*` works in both browsers for our usage.
 *
 * We prefer `chrome.*` everywhere for uniformity, but fall back to
 * `browser.*` if `chrome` is undefined (e.g. some sandboxed test contexts).
 */
const g = globalThis as unknown as { chrome?: typeof chrome; __atm_chrome?: typeof chrome; browser?: typeof chrome };

export const b = (g.__atm_chrome ?? g.chrome ?? g.browser) as typeof chrome;