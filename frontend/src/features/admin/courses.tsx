'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { useDebounced } from '@/hooks/use-debounced';
import { DataTable } from '@/components/ui/data-table';
import { Input, Select } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { Badge, EmptyState, PageHeader, Skeleton } from '@/components/ui/primitives';
import { ErrorState } from '@/components/states';
import { levelKey } from '@/features/courses/course-card';
import type { CourseStatus } from '@/lib/api/types';

const tone = { DRAFT: 'warning', PUBLISHED: 'success', ARCHIVED: 'neutral' } as const;

export function AdminCourses() {
  const { t, date, num } = useI18n();
  const { values, page, update } = useUrlFilters(['q', 'status'] as const);
  const [search, setSearch] = useState(values.q);
  const debounced = useDebounced(search);
  useEffect(() => {
    if (debounced !== values.q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);
  const q = useQuery({
    queryKey: ['admin', 'courses', values.q, values.status, page],
    queryFn: () =>
      adminApi.courses({
        q: values.q || undefined,
        status: (values.status || undefined) as CourseStatus | undefined,
        page,
        pageSize: 20,
      }),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <PageHeader title={t('nav.allCourses')} />
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mb-5 grid gap-3 rounded-(--radius-panel) border border-line bg-surface p-4 md:grid-cols-2"
      >
        <Input
          label={t('catalog.search')}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
        />
        <Select
          label={t('table.status')}
          value={values.status}
          onChange={(e) => update({ status: e.target.value })}
        >
          <option value="">{t('catalog.all')}</option>
          <option value="DRAFT">{t('status.DRAFT')}</option>
          <option value="PUBLISHED">{t('status.PUBLISHED')}</option>
          <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
        </Select>
      </form>
      {q.isPending ? (
        <Skeleton className="h-64" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <EmptyState title={t('catalog.noResultsTitle')} />
      ) : (
        <>
          <DataTable
            caption={t('nav.allCourses')}
            rows={q.data.items}
            rowKey={(r) => r.id}
            columns={[
              {
                key: 't',
                header: t('course.fTitle'),
                primary: true,
                cell: (r) =>
                  r.status === 'PUBLISHED' ? (
                    <Link
                      className="underline-offset-4 hover:underline"
                      href={`/courses/${r.slug}`}
                    >
                      {r.title}
                    </Link>
                  ) : (
                    r.title
                  ),
              },
              { key: 'i', header: t('table.instructor'), cell: (r) => r.instructor.fullName },
              { key: 'l', header: t('catalog.level'), cell: (r) => t(levelKey(r.level)) },
              { key: 'c', header: t('table.lessons'), cell: (r) => num(r.lessonCount) },
              {
                key: 's',
                header: t('table.status'),
                cell: (r) => <Badge tone={tone[r.status]}>{t(`status.${r.status}`)}</Badge>,
              },
              { key: 'd', header: t('table.created'), cell: (r) => date(r.createdAt) },
            ]}
          />
          <Pagination meta={q.data.meta} onPage={(p) => update({ page: p })} />
        </>
      )}
    </>
  );
}
