'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { enrollmentsApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { DataTable } from '@/components/ui/data-table';
import { Pagination } from '@/components/ui/pagination';
import { Badge, EmptyState, ProgressBar } from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';

export function LearnersTab({ courseId }: { courseId: string }) {
  const { t, date, pct } = useI18n();
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['instructor', 'course', courseId, 'learners', page],
    queryFn: () => enrollmentsApi.learners(courseId, { page, pageSize: 20 }),
    placeholderData: keepPreviousData,
  });
  return (
    <QueryBoundary query={q}>
      {(p) =>
        p.items.length === 0 ? (
          <EmptyState
            icon={<Users className="size-10" />}
            title={t('learners.emptyTitle')}
            description={t('learners.emptyText')}
          />
        ) : (
          <>
            <DataTable
              caption={t('learners.caption')}
              rows={p.items}
              rowKey={(r) => r.enrollmentId}
              columns={[
                {
                  key: 'name',
                  header: t('table.name'),
                  primary: true,
                  cell: (r) => r.student.fullName,
                },
                {
                  key: 'email',
                  header: t('auth.email'),
                  cell: (r) => <span className="ltr-isolate">{r.student.email}</span>,
                },
                {
                  key: 'status',
                  header: t('table.status'),
                  cell: (r) => (
                    <Badge
                      tone={
                        r.status === 'COMPLETED'
                          ? 'success'
                          : r.status === 'DROPPED'
                            ? 'neutral'
                            : 'info'
                      }
                    >
                      {t(`enrollment.${r.status}`)}
                    </Badge>
                  ),
                },
                {
                  key: 'progress',
                  header: t('progress.label'),
                  cell: (r) => (
                    <div className="flex min-w-32 items-center gap-2">
                      <ProgressBar
                        className="w-24"
                        value={r.progress?.percent ?? 0}
                        label={t('progress.label')}
                      />
                      <span className="text-sm">{pct(r.progress?.percent ?? 0)}</span>
                    </div>
                  ),
                },
                { key: 'since', header: t('table.enrolled'), cell: (r) => date(r.enrolledAt) },
              ]}
            />
            <Pagination meta={p.meta} onPage={setPage} />
          </>
        )
      }
    </QueryBoundary>
  );
}
