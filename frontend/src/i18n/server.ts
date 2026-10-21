import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type AppLocale } from './config';
import { makeT } from './translate';

export async function getLocale(): Promise<AppLocale> {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}
export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
