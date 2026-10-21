'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { homeFor } from '@/lib/roles';
import { Brand } from '@/components/brand';
import { LinkButton } from '@/components/ui/button';
import { LocaleSwitch } from './locale-switch';

export function SiteHeader() {
  const { t } = useI18n();
  const { user, status } = useAuth();
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/courses', label: t('nav.courses') },
    { href: '/#how', label: t('nav.how') },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Brand name={t('app.name')} />
        <nav aria-label={t('nav.main')} className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-(--radius-control) px-3 py-2 font-medium text-ink-800 hover:bg-ink-100"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <LocaleSwitch />
          {status === 'authenticated' && user ? (
            <LinkButton href={homeFor(user)} size="sm">
              {t('nav.myDashboard')}
            </LinkButton>
          ) : status === 'anonymous' ? (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                {t('auth.login')}
              </LinkButton>
              <LinkButton href="/register" variant="accent" size="sm">
                {t('auth.register')}
              </LinkButton>
            </>
          ) : (
            <span className="h-9 w-40" aria-hidden />
          )}
        </div>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-(--radius-control) hover:bg-ink-100 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? t('common.closeMenu') : t('common.openMenu')}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="border-t border-line bg-paper px-4 pb-4 md:hidden">
          <nav aria-label={t('nav.main')} className="flex flex-col py-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-3 text-lg font-medium"
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <LocaleSwitch />
            {status === 'authenticated' && user ? (
              <LinkButton href={homeFor(user)} size="sm">
                {t('nav.myDashboard')}
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="secondary" size="sm">
                  {t('auth.login')}
                </LinkButton>
                <LinkButton href="/register" variant="accent" size="sm">
                  {t('auth.register')}
                </LinkButton>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
