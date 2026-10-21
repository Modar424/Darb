'use client';

import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { usersApi } from '@/lib/api/endpoints';
import { ThemeSwitch } from './theme-switch';

export function LocaleSwitch() {
  const { locale, setLocale, t } = useI18n();
  const { user, setUser } = useAuth();
  const target = locale === 'ar' ? 'en' : 'ar';
  const onClick = () => {
    setLocale(target);
    // Persist for signed-in users (best effort: the cookie already applies the choice immediately).
    if (user)
      void usersApi
        .updateMe({ locale: target })
        .then(setUser)
        .catch(() => undefined);
  };
  return (
    <>
      <button
        type="button"
        onClick={onClick}
        lang={target}
        title={t('locale.switchTo')}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-(--radius-control) px-3 text-sm font-medium text-ink-800 hover:bg-ink-100"
      >
        <Languages className="size-4" aria-hidden />
        {target === 'en' ? 'English' : 'العربية'}
      </button>
      <ThemeSwitch />
    </>
  );
}
