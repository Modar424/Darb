import type { ReactNode } from 'react';
import { getT } from '@/i18n/server';
import { Brand } from '@/components/brand';
import { LocaleSwitch } from '@/components/layout/locale-switch';

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = await getT();
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_28rem]">
      <aside className="hidden flex-col justify-between bg-ink-900 p-10 text-ink-100 lg:flex">
        <Brand name={t('app.name')} light />
        <div>
          <p className="font-display text-3xl font-bold leading-snug text-white">
            {t('auth.sideTitle')}
          </p>
          <p className="mt-3 max-w-sm text-ink-200">{t('auth.sideText')}</p>
        </div>
        <p className="text-sm text-ink-200">{t('footer.tagline')}</p>
      </aside>
      <div className="flex flex-col">
        <div className="flex items-center justify-between p-4">
          <div className="lg:hidden">
            <Brand name={t('app.name')} />
          </div>
          <div className="ms-auto">
            <LocaleSwitch />
          </div>
        </div>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
