import { describe, expect, it } from 'vitest';
import { ar } from './messages/ar';
import { en } from './messages/en';
import { translate } from './translate';
import { formatDate, formatNumber } from './format';
import { dirOf, isLocale } from './config';

describe('i18n', () => {
  it('has identical key sets in Arabic and English', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ar).sort());
  });
  it('has no empty strings', () => {
    for (const d of [ar, en])
      for (const [k, v] of Object.entries(d)) expect(v.trim(), k).not.toBe('');
  });
  it('uses the same interpolation variables in both languages', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(ar) as (keyof typeof ar)[])
      expect(vars(en[k]), k).toEqual(vars(ar[k]));
  });
  it('interpolates variables and leaves unknown ones visible', () => {
    expect(translate('en', 'common.pageOf', { page: 2, total: 5 })).toBe('Page 2 of 5');
    expect(translate('en', 'common.pageOf', { page: 2 })).toBe('Page 2 of {total}');
  });
  it('knows direction and valid locales', () => {
    expect(dirOf('ar')).toBe('rtl');
    expect(dirOf('en')).toBe('ltr');
    expect(isLocale('fr')).toBe(false);
  });
  it('formats numbers with Latin digits in Arabic and handles empty dates', () => {
    expect(formatNumber('ar', 1234)).toMatch(/1.234|1,234/);
    expect(formatDate('ar', null)).toBe('—');
    expect(formatDate('en', 'not-a-date')).toBe('—');
    expect(formatDate('en', '2026-03-05T10:00:00Z')).toContain('2026');
  });
});
