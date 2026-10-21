'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { useAuth } from '@/lib/auth';
import { Brand } from '@/components/brand';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/primitives';
import { LocaleSwitch } from './locale-switch';
import { navFor, type NavSection } from './nav-config';

function NavList({ sections, onNavigate }: { sections: NavSection[]; onNavigate?: () => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  return (
    <nav aria-label={t('nav.main')} className="flex flex-col gap-6">
      {sections.map((s) => (
        <div key={s.title}>
          <p className="mb-2 px-3 text-sm font-semibold text-ink-200">{t(s.title)}</p>
          <ul className="flex flex-col gap-1">
            {s.items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-(--radius-control) px-3 font-medium transition-colors',
                      active ? 'bg-white text-ink-950' : 'text-ink-100 hover:bg-ink-800',
                    )}
                  >
                    <item.icon className="size-5 shrink-0" aria-hidden />
                    {t(item.label)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { user, status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const dlg = useRef<HTMLDialogElement>(null);

  // Signed-out visitors (e.g. stale cookie) are sent to the login page with the intended destination.
  useEffect(() => {
    if (status === 'anonymous') router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [status, router, pathname]);

  useEffect(() => {
    const el = dlg.current;
    if (!el) return;
    if (drawer && !el.open) el.showModal();
    if (!drawer && el.open) el.close();
  }, [drawer]);

  if (status !== 'authenticated' || !user) {
    return (
      <div className="mx-auto max-w-5xl p-6" aria-busy="true">
        <Skeleton className="mb-6 h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const sections = navFor(user);
  const onLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto bg-ink-900 p-4 lg:flex">
        <div className="px-1 pt-1">
          <Brand name={t('app.name')} href="/" light />
        </div>
        <NavList sections={sections} />
        <div className="mt-auto border-t border-ink-700 pt-4 text-ink-100">
          <p className="truncate px-3 text-sm font-semibold">{user.fullName}</p>
          <p className="ltr-isolate truncate px-3 text-sm text-ink-200">{user.email}</p>
          <button
            type="button"
            onClick={onLogout}
            className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-(--radius-control) px-3 font-medium hover:bg-ink-800"
          >
            <LogOut className="size-5" aria-hidden />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-2 border-b border-line bg-paper/90 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label={t('common.openMenu')}
            aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="inline-flex size-11 items-center justify-center rounded-(--radius-control) hover:bg-ink-100"
          >
            <Menu className="size-6" aria-hidden />
          </button>
          <Brand name={t('app.name')} href="/" />
          <LocaleSwitch />
        </header>
        <div className="hidden items-center justify-end gap-2 border-b border-line bg-paper px-8 py-2 lg:flex">
          <LocaleSwitch />
        </div>
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8"
        >
          {children}
        </main>
      </div>

      {/* Mobile navigation drawer (native dialog => focus trap + Esc) */}
      <dialog
        ref={dlg}
        aria-label={t('nav.main')}
        onClose={() => setDrawer(false)}
        onClick={(e) => e.target === dlg.current && setDrawer(false)}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] bg-ink-900 p-4 text-white lg:hidden"
      >
        {drawer && (
          <div className="flex h-full flex-col gap-6">
            <div className="flex items-center justify-between">
              <Brand name={t('app.name')} href="/" light />
              <button
                type="button"
                aria-label={t('common.closeMenu')}
                onClick={() => setDrawer(false)}
                className="rounded-md p-2 hover:bg-ink-800"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <NavList sections={sections} onNavigate={() => setDrawer(false)} />
            <div className="mt-auto border-t border-ink-700 pt-4">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 flex min-h-11 w-full items-center gap-3 rounded-(--radius-control) px-3 font-medium hover:bg-ink-800"
              >
                <LogOut className="size-5" aria-hidden />
                {t('auth.logout')}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
