import type { Settings, SiteOverrides } from "./types.js";

export function currentHostname(): string {
  try {
    return location.hostname;
  } catch {
    return "";
  }
}

export function isSiteEnabled(settings: Settings, overrides: SiteOverrides, host: string): boolean {
  if (!host) return settings.globalEnabledByDefault;
  const override = overrides[host];
  if (override === true) return true;
  if (override === false) return false;
  return settings.globalEnabledByDefault;
}