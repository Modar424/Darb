'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { dirOf, LOCALE_COOKIE, type AppLocale } from './config';
import { formatDate, formatNumber, formatPercent } from './format';
import { makeT, type TFunction } from './translate';

interface I18nValue {
  locale: AppLocale;
  dir: 'rtl' | 'ltr';
  t: TFunction;
  setLocale: (l: AppLocale) => void;
  date: (v: string | Date | null | undefined, withTime?: boolean) => string;
  num: (n: number) => string;
  pct: (n: number) => string;
}
const Ctx = createContext<I18nValue | null>(null);

export function I18nProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const router = useRouter();
  const setLocale = useCallback(
    (l: AppLocale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; Path=/; Max-Age=31536000; SameSite=Lax`;
      router.refresh();
    },
    [router],
  );
  const value = useMemo<I18nValue>(
    () => ({
      locale,
      dir: dirOf(locale),
      t: makeT(locale),
      setLocale,
      date: (v, withTime) => formatDate(locale, v, withTime),
      num: (n) => formatNumber(locale, n),
      pct: (n) => formatPercent(locale, n),
    }),
    [locale, setLocale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}
