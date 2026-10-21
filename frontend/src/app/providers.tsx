'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { AuthProvider } from '@/lib/auth';
import { I18nProvider } from '@/i18n/provider';
import type { AppLocale } from '@/i18n/config';
import { ToastProvider } from '@/components/ui/toast';

export function Providers({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (count, err) =>
              !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
          },
        },
      }),
  );
  return (
    <I18nProvider locale={locale}>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </I18nProvider>
  );
}
