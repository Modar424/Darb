'use client';

import { useQuery } from '@tanstack/react-query';
import { GraduationCap } from 'lucide-react';
import { coursesApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { QueryBoundary } from '@/components/states';
import { EmptyState, Skeleton } from '@/components/ui/primitives';
import { CourseCard } from './course-card';

export function LatestCourses() {
  const { t } = useI18n();
  const q = useQuery({
    queryKey: ['courses', 'latest'],
    queryFn: () => coursesApi.list({ pageSize: 3 }),
  });
  return (
    <QueryBoundary
      query={q}
      skeleton={
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      }
    >
      {(page) =>
        page.items.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="size-10" />}
            title={t('catalog.emptyTitle')}
            description={t('catalog.emptyText')}
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-3">
            {page.items.map((c) => (
              <li key={c.id}>
                <CourseCard course={c} />
              </li>
            ))}
          </ul>
        )
      }
    </QueryBoundary>
  );
}
