import type { Mappings } from "../types.js";
import { stripAt } from "./text.js";

export function filterAndSortMappings(
  mappings: Mappings,
  query: string,
): [string, string][] {
  const term = query.trim().toLowerCase();
  return Object.entries(mappings)
    .filter(([key, val]) => {
      if (!term) return true;
      return key.toLowerCase().includes(term) || val.toLowerCase().includes(term);
    })
    .sort(([a], [b]) => a.localeCompare(b));
}

export function getMappingEmptyMessage(total: number, query: string): string {
  const term = query.trim();
  if (term) return `No matches for "${term}".`;
  if (total === 0) return "No mappings yet. Add your first shortcut above.";
  return "No mappings to show.";
}

export function getNewMappingError(
  mappings: Mappings,
  key: string,
  value: string,
  trigger: string,
): string | null {
  if (!key || !value) return "Enter both a shortcut and replacement.";
  if (mappings[key] !== undefined) return `${trigger}${key} already exists.`;
  return null;
}

export function validateMappingKey(
  newKey: string,
  oldKey: string,
  mappings: Mappings,
): boolean {
  const stripped = stripAt(newKey);
  if (!stripped) return false;
  if (stripped !== oldKey && mappings[stripped] !== undefined) return false;
  return true;
}

export interface EditFieldOptions {
  key: string;
  value: string;
  mappings: Mappings;
  onSaved: (newKey: string, newVal: string) => void | Promise<void>;
  onCancelled: () => void;
}

export interface EditFields {
  keyInput: HTMLInputElement;
  valInput: HTMLInputElement;
  validate(): boolean;
  save(): Promise<void>;
  cancel(): void;
  focus(): void;
}

// Page owns the surrounding row/container; it appends keyInput/valInput into
// its own field wrappers and wires save/cancel buttons. Keeps <li> vs <div>
// markup intact while sharing validation + save/cancel semantics.
export function createEditFields(opts: EditFieldOptions): EditFields {
  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.value = opts.key;
  keyInput.autocomplete = "off";

  const valInput = document.createElement("input");
  valInput.type = "text";
  valInput.value = opts.value;
  valInput.autocomplete = "off";

  function validate(): boolean {
    const ok = validateMappingKey(keyInput.value, opts.key, opts.mappings);
    keyInput.classList.toggle("invalid", !ok);
    return ok;
  }

  async function save(): Promise<void> {
    const newKey = stripAt(keyInput.value);
    const newVal = valInput.value.trim();
    if (!newKey || !newVal) {
      opts.onCancelled();
      return;
    }
    if (!validate()) {
      keyInput.focus();
      return;
    }
    await opts.onSaved(newKey, newVal);
  }

  function cancel(): void {
    opts.onCancelled();
  }

  keyInput.addEventListener("input", validate);
  keyInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      valInput.focus();
    } else if (e.key === "Escape") {
      cancel();
    }
  });
  valInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      cancel();
    }
  });

  function focus(): void {
    keyInput.focus();
  }

  return { keyInput, valInput, validate, save, cancel, focus };
}
