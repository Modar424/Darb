/** Removes control characters (except tab/newline) and trims. Output is plain text, never HTML. */
export function cleanText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function slugify(input: string): string {
  const base = input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
  return base || 'course';
}
