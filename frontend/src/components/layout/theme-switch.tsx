'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { THEME_COOKIE, type Theme } from '@/lib/theme';

const current = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => mo.disconnect();
};

/** Light/dark toggle. The choice is a first-party cookie read on the server, so there is no flash on reload. */
export function ThemeSwitch() {
  const { t } = useI18n();
  const theme = useSyncExternalStore(subscribe, current, () => 'light' as Theme);

  useEffect(() => {
    const el = document.documentElement;
    if (!el.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches)
      el.dataset.theme = 'dark';
  }, []);

  const toggle = () => {
    const next: Theme = current() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={t('theme.toggle')}
      aria-pressed={theme === 'dark'}
      className="inline-flex size-10 items-center justify-center rounded-(--radius-control) text-ink-800 hover:bg-ink-100"
    >
      {theme === 'dark' ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </button>
  );
}
