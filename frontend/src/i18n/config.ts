export const LOCALES = ['ar', 'en'] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = 'ar';
export const LOCALE_COOKIE = 'lms_locale';
export const isLocale = (v: unknown): v is AppLocale => v === 'ar' || v === 'en';
export const dirOf = (l: AppLocale): 'rtl' | 'ltr' => (l === 'ar' ? 'rtl' : 'ltr');
/** BCP-47 tags used for number/date formatting. Arabic uses Latin digits for clarity next to Latin text. */
export const intlTag = (l: AppLocale): string => (l === 'ar' ? 'ar-u-nu-latn' : 'en-US');
