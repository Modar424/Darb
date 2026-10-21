import { intlTag, type AppLocale } from './config';

export function formatDate(
  locale: AppLocale,
  value: string | Date | null | undefined,
  withTime = false,
): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(intlTag(locale), {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
  }).format(d);
}
export const formatNumber = (locale: AppLocale, n: number): string =>
  new Intl.NumberFormat(intlTag(locale)).format(n);
export const formatPercent = (locale: AppLocale, n: number): string =>
  `${formatNumber(locale, Math.round(n))}%`;
