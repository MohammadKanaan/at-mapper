/** Look up an element by id and verify its type, failing loudly if the markup drifts. */
export function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  if (!(el instanceof type)) throw new Error(`#${id} is not a ${type.name}`);
  return el;
}
