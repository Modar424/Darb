import { BadRequestException } from '@nestjs/common';
import { isAcceptablePasswordValue } from './dto/validators';
import { escapeLike, parseSort, PageResult } from './dto/pagination';
import { redact } from './logging/json-logger';
import { safeEqualHex, sha256Hex, randomToken } from './utils/crypto';
import { cleanText, slugify } from './utils/text';

describe('password policy', () => {
  it.each([
    ['short1'],
    ['password123'],
    ['aaaaaaaaaaaa'],
    ['x'.repeat(129)],
    [123 as unknown as string],
  ])('rejects %s', (p) => expect(isAcceptablePasswordValue(p)).toBe(false));
  it('rejects passwords containing the e-mail local part', () => {
    expect(isAcceptablePasswordValue('my-johndoe-secret-1', 'johndoe@example.test')).toBe(false);
  });
  it('accepts long passphrases without composition rules', () => {
    expect(isAcceptablePasswordValue('correct horse battery staple')).toBe(true);
  });
});

describe('pagination helpers', () => {
  const allowed = { title: 'c.title', createdAt: 'c.createdAt' };
  it('maps allowlisted sort fields to columns', () => {
    expect(parseSort('title:desc', allowed, { field: 'createdAt', dir: 'ASC' })).toEqual({
      column: 'c.title',
      dir: 'DESC',
    });
    expect(parseSort(undefined, allowed, { field: 'createdAt', dir: 'DESC' })).toEqual({
      column: 'c.createdAt',
      dir: 'DESC',
    });
  });
  it('rejects unknown fields and directions (no SQL injection surface)', () => {
    expect(() =>
      parseSort('id; DROP TABLE users:asc', allowed, { field: 'title', dir: 'ASC' }),
    ).toThrow(BadRequestException);
    expect(() => parseSort('title:up', allowed, { field: 'title', dir: 'ASC' })).toThrow(
      BadRequestException,
    );
  });
  it('escapes LIKE wildcards and computes page metadata', () => {
    expect(escapeLike('50%_off\\')).toBe('50\\%\\_off\\\\');
    expect(PageResult.of([], 41, { page: 2, pageSize: 20 }).meta).toEqual({
      page: 2,
      pageSize: 20,
      total: 41,
      totalPages: 3,
    });
    expect(PageResult.of([], 0, { page: 1, pageSize: 20 }).meta.totalPages).toBe(1);
  });
});

describe('redact', () => {
  it('masks sensitive keys recursively and truncates huge strings', () => {
    const out = redact({
      a: 1,
      password: 'x',
      nested: { resetToken: 't', Authorization: 'Bearer z', ok: 'fine' },
      list: [{ cookie: 'c' }],
      big: 'y'.repeat(600),
    }) as Record<string, unknown>;
    expect(out.password).toBe('[REDACTED]');
    expect(out.nested).toEqual({
      resetToken: '[REDACTED]',
      Authorization: '[REDACTED]',
      ok: 'fine',
    });
    expect(out.list).toEqual([{ cookie: '[REDACTED]' }]);
    expect((out.big as string).length).toBeLessThan(600);
  });
});

describe('crypto & text utils', () => {
  it('produces unpredictable url-safe tokens and stable hashes', () => {
    expect(randomToken()).not.toBe(randomToken());
    expect(randomToken()).toMatch(/^[\w-]{43}$/);
    expect(sha256Hex('a')).toHaveLength(64);
  });
  it('compares in constant-time safely for different lengths', () => {
    expect(safeEqualHex('abc', 'abc')).toBe(true);
    expect(safeEqualHex('abc', 'abd')).toBe(false);
    expect(safeEqualHex('abc', 'abcd')).toBe(false);
  });
  it('cleans control characters and slugifies unicode', () => {
    expect(cleanText('  a\u0000b\u0007c \n ')).toBe('abc');
    expect(slugify('مرحبا بالعالم 101!')).toBe('مرحبا-بالعالم-101');
    expect(slugify('!!!')).toBe('course');
  });
});
