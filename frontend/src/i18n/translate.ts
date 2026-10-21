import type { AppLocale } from './config';
import { ar, type MessageKey } from './messages/ar';
import { en } from './messages/en';

const dictionaries: Record<AppLocale, Record<MessageKey, string>> = { ar, en };
export type Vars = Record<string, string | number>;
export type TFunction = (key: MessageKey, vars?: Vars) => string;

export function translate(locale: AppLocale, key: MessageKey, vars?: Vars): string {
  const template = dictionaries[locale][key] ?? ar[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
export const makeT =
  (locale: AppLocale): TFunction =>
  (key, vars) =>
    translate(locale, key, vars);
