'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { Card, PageHeader, Skeleton } from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';

function Metric({ label, value, href }: { label: string; value: number; href?: string }) {
  const { num } = useI18n();
  const body = (
    <>
      <p className="font-display text-3xl font-bold">{num(value)}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </>
  );
  return (
    <Card className="p-5">
      {href ? (
        <Link href={href} className="block rounded hover:underline">
          {body}
        </Link>
      ) : (
        body
      )}
    </Card>
  );
}

export function AdminOverview() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.stats });
  return (
    <>
      <PageHeader title={t('admin.title')} description={t('admin.subtitle')} />
      <QueryBoundary
        query={q}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        }
      >
        {(s) => (
          <div className="grid gap-8">
            <section aria-labelledby="u">
              <h2 id="u" className="mb-3 text-lg font-semibold">
                {t('admin.users')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={t('admin.totalUsers')} value={s.users.total} href="/admin/users" />
                <Metric label={t('role.STUDENT')} value={s.users.byRole.STUDENT ?? 0} />
                <Metric label={t('role.INSTRUCTOR')} value={s.users.byRole.INSTRUCTOR ?? 0} />
                <Metric label={t('role.ADMIN')} value={s.users.byRole.ADMIN ?? 0} />
              </div>
            </section>
            <section aria-labelledby="c">
              <h2 id="c" className="mb-3 text-lg font-semibold">
                {t('admin.courses')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric
                  label={t('admin.totalCourses')}
                  value={s.courses.total}
                  href="/admin/courses"
                />
                <Metric label={t('status.PUBLISHED')} value={s.courses.byStatus.PUBLISHED ?? 0} />
                <Metric label={t('status.DRAFT')} value={s.courses.byStatus.DRAFT ?? 0} />
                <Metric label={t('status.ARCHIVED')} value={s.courses.byStatus.ARCHIVED ?? 0} />
              </div>
            </section>
            <section aria-labelledby="a">
              <h2 id="a" className="mb-3 text-lg font-semibold">
                {t('admin.activity')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Metric label={t('admin.activeEnrollments')} value={s.enrollments.active} />
                <Metric label={t('admin.completedEnrollments')} value={s.enrollments.completed} />
                <Metric label={t('admin.attempts')} value={s.assessmentAttempts} />
                <Metric label={t('admin.submissions')} value={s.assignmentSubmissions} />
              </div>
            </section>
          </div>
        )}
      </QueryBoundary>
    </>
  );
}
