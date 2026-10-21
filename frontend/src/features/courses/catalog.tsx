'use client';

import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { coursesApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { useUrlFilters } from '@/hooks/use-url-filters';
import { useDebounced } from '@/hooks/use-debounced';
import type { CourseLevel, Locale } from '@/lib/api/types';
import { Input, Select } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { ErrorState } from '@/components/states';
import { CourseCard } from './course-card';

const FILTER_KEYS = ['q', 'level', 'language', 'sort'] as const;
const SORTS = ['publishedAt:desc', 'title:asc'] as const;

export function Catalog() {
  const { t, num } = useI18n();
  const { values, page, update } = useUrlFilters(FILTER_KEYS);
  const [search, setSearch] = useState(values.q);
  const debounced = useDebounced(search);

  // Push the debounced search term into the URL; the URL then drives the query.
  useEffect(() => {
    if (debounced !== values.q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const sort = (SORTS as readonly string[]).includes(values.sort) ? values.sort : SORTS[0];
  const query = useQuery({
    queryKey: ['courses', 'catalog', values.q, values.level, values.language, sort, page],
    queryFn: () =>
      coursesApi.list({
        q: values.q || undefined,
        level: (values.level || undefined) as CourseLevel | undefined,
        language: (values.language || undefined) as Locale | undefined,
        sort,
        page,
        pageSize: 9,
      }),
    placeholderData: keepPreviousData,
  });
  const hasFilters = !!(values.q || values.level || values.language);

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        className="mb-6 grid gap-3 rounded-(--radius-panel) border border-line bg-surface p-4 md:grid-cols-[2fr_1fr_1fr_1fr]"
      >
        <Input
          label={t('catalog.search')}
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          maxLength={100}
          placeholder={t('catalog.searchPlaceholder')}
        />
        <Select
          label={t('catalog.level')}
          value={values.level}
          onChange={(e) => update({ level: e.target.value })}
        >
          <option value="">{t('catalog.all')}</option>
          <option value="BEGINNER">{t('level.BEGINNER')}</option>
          <option value="INTERMEDIATE">{t('level.INTERMEDIATE')}</option>
          <option value="ADVANCED">{t('level.ADVANCED')}</option>
        </Select>
        <Select
          label={t('catalog.language')}
          value={values.language}
          onChange={(e) => update({ language: e.target.value })}
        >
          <option value="">{t('catalog.all')}</option>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </Select>
        <Select
          label={t('catalog.sort')}
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
        >
          <option value="publishedAt:desc">{t('catalog.sortNewest')}</option>
          <option value="title:asc">{t('catalog.sortTitle')}</option>
        </Select>
      </form>

      {query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          icon={<SearchX className="size-10" />}
          title={hasFilters ? t('catalog.noResultsTitle') : t('catalog.emptyTitle')}
          description={hasFilters ? t('catalog.noResultsText') : t('catalog.emptyText')}
          action={
            hasFilters ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch('');
                  update({ q: null, level: null, language: null });
                }}
              >
                {t('catalog.clear')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {t('catalog.resultCount', { n: num(query.data.meta.total) })}
          </p>
          <ul
            className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${query.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {query.data.items.map((c) => (
              <li key={c.id}>
                <CourseCard course={c} headingLevel="h2" />
              </li>
            ))}
          </ul>
          <Pagination meta={query.data.meta} onPage={(p) => update({ page: p })} />
        </>
      )}
    </div>
  );
}
