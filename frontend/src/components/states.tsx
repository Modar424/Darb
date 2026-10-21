'use client';

import type { ReactNode } from 'react';
import { FileQuestion, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '@/lib/api/client';
import { errorKey } from '@/lib/api/error-messages';
import { useI18n } from '@/i18n/provider';
import { Button, LinkButton } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/primitives';

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  if (error instanceof ApiError && error.status === 403) return <ForbiddenState />;
  if (error instanceof ApiError && error.status === 404) return <NotFoundState />;
  const offline = error instanceof ApiError && error.isNetwork;
  return (
    <EmptyState
      icon={offline ? <WifiOff className="size-10" /> : <RefreshCw className="size-10" />}
      title={offline ? t('state.offlineTitle') : t('state.errorTitle')}
      description={t(errorKey(error))}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry}>
            {t('common.retry')}
          </Button>
        )
      }
    />
  );
}
export function ForbiddenState() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<ShieldAlert className="size-10" />}
      title={t('state.forbiddenTitle')}
      description={t('state.forbiddenText')}
      action={
        <LinkButton href="/" variant="secondary">
          {t('nav.home')}
        </LinkButton>
      }
    />
  );
}
export function NotFoundState() {
  const { t } = useI18n();
  return (
    <EmptyState
      icon={<FileQuestion className="size-10" />}
      title={t('state.notFoundTitle')}
      description={t('state.notFoundText')}
      action={
        <LinkButton href="/" variant="secondary">
          {t('nav.home')}
        </LinkButton>
      }
    />
  );
}
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full" />
      ))}
    </div>
  );
}

/** Standard loading / error / success switch for a query so every page handles all three states. */
export function QueryBoundary<T>({
  query,
  skeleton,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <ListSkeleton />}</>;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  return <>{children(query.data)}</>;
}
