'use client';

import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/primitives';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  useEffect(() => {
    // Only the opaque digest is logged; messages may contain internals.
    console.error('render error', error.digest ?? '');
  }, [error]);
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-16">
      <EmptyState
        icon={<RefreshCw className="size-10" />}
        title={t('state.errorTitle')}
        description={t('state.renderError')}
        action={<Button onClick={reset}>{t('common.retry')}</Button>}
      />
    </main>
  );
}
