'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { useDebounced } from '@/hooks/use-debounced';
import { ErrorState } from '@/components/states';

export function AdminAudit() {
  const { t, date } = useI18n();
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const debounced = useDebounced(action);
  const q = useQuery({
    queryKey: ['admin', 'audit', debounced, page],
    queryFn: () => adminApi.audit({ action: debounced || undefined, page, pageSize: 25 }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title={t('nav.audit')} description={t('admin.auditText')} />
      <div className="mb-5 max-w-sm">
        <Input
          label={t('admin.auditAction')}
          dir="ltr"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          maxLength={100}
          placeholder="auth.login"
        />
      </div>
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={t('admin.noAudit')} />
      ) : (
        <>
          <DataTable
            caption={t('nav.audit')}
            rows={q.data.items}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 'a',
                header: t('admin.auditAction'),
                primary: true,
                cell: (r) => <code className="ltr-isolate text-sm">{r.action}</code>,
              },
              {
                key: 'e',
                header: t('admin.auditEntity'),
                cell: (r) =>
                  r.entityType ? <span className="ltr-isolate text-sm">{r.entityType}</span> : '—',
              },
              {
                key: 'u',
                header: t('admin.auditActor'),
                cell: (r) =>
                  r.actorId ? (
                    <span className="ltr-isolate text-xs">{r.actorId.slice(0, 8)}…</span>
                  ) : (
                    '—'
                  ),
              },
              { key: 'd', header: t('table.date'), cell: (r) => date(r.createdAt, true) },
            ]}
          />
          <Pagination meta={q.data.meta} onPage={setPage} />
        </>
      )}
    </>
  );
}
