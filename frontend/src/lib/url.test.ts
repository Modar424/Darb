import { describe, expect, it } from 'vitest';
import { safeHttpUrl } from './url';

describe('safeHttpUrl', () => {
  it('allows http(s) only', () => {
    expect(safeHttpUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeHttpUrl('http://example.com')).toBe('http://example.com/');
  });
  it('rejects dangerous or malformed values', () => {
    for (const v of [
      'javascript:alert(1)',
      'data:text/html,<script>',
      'ftp://x',
      'not a url',
      '',
      null,
      undefined,
    ]) {
      expect(safeHttpUrl(v as string)).toBeNull();
    }
  });
});
