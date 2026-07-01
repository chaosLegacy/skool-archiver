const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;
const WHITESPACE = /\s+/g;

export function sanitizeFilename(name: string, maxLength = 150): string {
  const cleaned = name
    .trim()
    .replace(INVALID_FILENAME_CHARS, "_")
    .replace(WHITESPACE, "_")
    .replace(/\.+$/, "");
  return (cleaned || "untitled").slice(0, maxLength);
}

export function sanitizePathSegment(segment: string): string {
  return sanitizeFilename(segment, 100);
}

export function formatFilename(template: string, vars: Record<string, string | number>): string {
  const rendered = template.replace(/\{(\w+)\}/g, (_match, key: string) =>
    key in vars ? String(vars[key]) : `{${key}}`
  );
  return sanitizeFilename(rendered);
}
