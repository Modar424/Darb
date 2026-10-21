'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Award, BookOpenCheck, Flame, GraduationCap, Target } from 'lucide-react';
import { enrollmentsApi, progressApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/i18n/provider';
import { LinkButton } from '@/components/ui/button';
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Skeleton,
} from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';

function Stat({ icon: Icon, label, value }: { icon: typeof Award; label: string; value: string }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span className="flex size-11 items-center justify-center rounded-full bg-ink-100 text-ink-800">
        <Icon className="size-5" aria-hidden />
      </span>
      <div>
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </div>
    </Card>
  );
}

export function StudentDashboard() {
  const { t, num, pct, date } = useI18n();
  const { user } = useAuth();
  const summary = useQuery({ queryKey: ['progress', 'summary'], queryFn: progressApi.summary });
  const mine = useQuery({
    queryKey: ['enrollments', 'mine'],
    queryFn: () => enrollmentsApi.mine({ pageSize: 50 }),
  });

  return (
    <>
      <PageHeader
        title={t('student.welcome', { name: user?.fullName.split(' ')[0] ?? '' })}
        description={t('student.subtitle')}
        actions={
          <LinkButton href="/courses" variant="secondary">
            {t('student.browse')}
          </LinkButton>
        }
      />

      <QueryBoundary
        query={summary}
        skeleton={
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        }
      >
        {(s) => (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={BookOpenCheck}
              label={t('student.statEnrolled')}
              value={num(s.enrolledCourses)}
            />
            <Stat
              icon={Flame}
              label={t('student.statInProgress')}
              value={num(s.inProgressCourses)}
            />
            <Stat icon={Award} label={t('student.statCompleted')} value={num(s.completedCourses)} />
            <Stat
              icon={Target}
              label={t('student.statAverage')}
              value={pct(s.averageProgressPercent)}
            />
          </div>
        )}
      </QueryBoundary>

      <section className="mt-10" aria-labelledby="my-courses">
        <h2 id="my-courses" className="mb-3 text-xl font-semibold">
          {t('student.myCourses')}
        </h2>
        <QueryBoundary query={mine}>
          {(page) =>
            page.items.length === 0 ? (
              <EmptyState
                icon={<GraduationCap className="size-10" />}
                title={t('student.emptyTitle')}
                description={t('student.emptyText')}
                action={
                  <LinkButton href="/courses" variant="accent">
                    {t('student.browse')}
                  </LinkButton>
                }
              />
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {page.items.map((e) => (
                  <li key={e.id}>
                    <Card className="flex h-full flex-col gap-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold">{e.course.title}</h3>
                        <Badge tone={e.status === 'COMPLETED' ? 'success' : 'info'}>
                          {t(`enrollment.${e.status}`)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted">
                        {t('course.by', { name: e.course.instructor.fullName })}
                      </p>
                      <div>
                        <div className="mb-1 flex justify-between text-sm">
                          <span>{t('progress.label')}</span>
                          <span>
                            {pct(e.progress?.percent ?? 0)} ·{' '}
                            {t('progress.lessonsOf', {
                              done: num(e.progress?.completedLessons ?? 0),
                              total: num(e.progress?.totalLessons ?? 0),
                            })}
                          </span>
                        </div>
                        <ProgressBar value={e.progress?.percent ?? 0} label={t('progress.label')} />
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                        <span className="text-sm text-muted">
                          {t('student.enrolledOn', { date: date(e.enrolledAt) })}
                        </span>
                        <LinkButton href={`/learn/${e.course.id}`} size="sm">
                          {e.status === 'COMPLETED' ? t('course.review') : t('course.continue')}
                        </LinkButton>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      </section>

      <section className="mt-10" aria-labelledby="recent">
        <h2 id="recent" className="mb-3 text-xl font-semibold">
          {t('student.recent')}
        </h2>
        <QueryBoundary query={summary} skeleton={<Skeleton className="h-24" />}>
          {(s) =>
            s.recentActivity.length === 0 ? (
              <p className="text-muted">{t('student.recentEmpty')}</p>
            ) : (
              <Card>
                <ul className="divide-y divide-line">
                  {s.recentActivity.map((a) => (
                    <li
                      key={`${a.lessonId}-${a.completedAt}`}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <Link
                        href={`/learn/${a.courseId}/lessons/${a.lessonId}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {a.lessonTitle ?? t('lesson.untitled')}
                      </Link>
                      <span className="text-sm text-muted">{date(a.completedAt, true)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          }
        </QueryBoundary>
      </section>
    </>
  );
}
