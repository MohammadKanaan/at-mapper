export function stripAt(value: string): string {
  return value.replace(/^@+/, "").trim();
}