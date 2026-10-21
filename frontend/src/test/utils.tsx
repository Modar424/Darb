import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { I18nProvider } from '@/i18n/provider';
import { ToastProvider } from '@/components/ui/toast';
import type { AppLocale } from '@/i18n/config';

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};
export let searchParamsMock = new URLSearchParams();
export const setSearchParams = (qs: string) => {
  searchParamsMock = new URLSearchParams(qs);
};

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => '/current',
  useSearchParams: () => searchParamsMock,
}));

export function renderApp(
  ui: ReactElement,
  opts: { locale?: AppLocale } & Omit<RenderOptions, 'wrapper'> = {},
) {
  const { locale = 'ar', ...rest } = opts;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider locale={locale}>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
  return render(ui, { wrapper: Wrapper, ...rest });
}
