'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Award, ClipboardList, FileEdit } from 'lucide-react';
import { assessmentsApi, assignmentsApi, coursesApi, progressApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { LinkButton } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Alert, Badge, Card, EmptyState, ProgressBar, Skeleton } from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';
import { CurriculumList } from '@/features/courses/curriculum-list';
import type { Curriculum } from '@/lib/api/types';

export const firstIncompleteLesson = (c: Curriculum) =>
  c.modules.flatMap((m) => m.lessons).find((l) => !l.completed) ??
  c.modules.flatMap((m) => m.lessons)[0];

function AssessmentsTab({ courseId }: { courseId: string }) {
  const { t, pct } = useI18n();
  const q = useQuery({
    queryKey: ['learn', courseId, 'assessments'],
    queryFn: () => assessmentsApi.list(courseId, { pageSize: 50 }),
  });
  return (
    <QueryBoundary query={q}>
      {(page) =>
        page.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="size-10" />}
            title={t('assess.emptyTitle')}
            description={t('assess.emptyText')}
          />
        ) : (
          <ul className="grid gap-3">
            {page.items.map((a) => (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/learn/${courseId}/assessments/${a.id}`}
                      className="text-lg font-semibold underline-offset-4 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {t('assess.questionsCount', { n: a.questionCount ?? 0 })} ·{' '}
                      {t('assess.passingLine', { n: a.passingPercent })}
                      {a.myProgress?.bestPercent != null &&
                        ` · ${t('assess.best', { n: pct(a.myProgress.bestPercent) })}`}
                    </p>
                  </div>
                  {a.myProgress?.passed ? (
                    <Badge tone="success">{t('assess.passed')}</Badge>
                  ) : a.myProgress && a.myProgress.attemptsUsed > 0 ? (
                    <Badge tone="warning">{t('assess.notPassed')}</Badge>
                  ) : (
                    <Badge>{t('assess.notStarted')}</Badge>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )
      }
    </QueryBoundary>
  );
}

function AssignmentsTab({ courseId }: { courseId: string }) {
  const { t, date } = useI18n();
  const q = useQuery({
    queryKey: ['learn', courseId, 'assignments'],
    queryFn: () => assignmentsApi.list(courseId, { pageSize: 50 }),
  });
  return (
    <QueryBoundary query={q}>
      {(page) =>
        page.items.length === 0 ? (
          <EmptyState
            icon={<FileEdit className="size-10" />}
            title={t('assign.emptyTitle')}
            description={t('assign.emptyText')}
          />
        ) : (
          <ul className="grid gap-3">
            {page.items.map((a) => (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      href={`/learn/${courseId}/assignments/${a.id}`}
                      className="text-lg font-semibold underline-offset-4 hover:underline"
                    >
                      {a.title}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {t('assign.due', { date: a.dueAt ? date(a.dueAt, true) : t('assign.noDue') })}{' '}
                      · {t('assign.points', { n: a.maxPoints })}
                    </p>
                  </div>
                  {a.mySubmission?.status === 'GRADED' ? (
                    <Badge tone="success">
                      {t('assign.graded', { n: a.mySubmission.grade ?? 0, max: a.maxPoints })}
                    </Badge>
                  ) : a.mySubmission ? (
                    <Badge tone="info">{t('assign.submitted')}</Badge>
                  ) : (
                    <Badge>{t('assign.notSubmitted')}</Badge>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )
      }
    </QueryBoundary>
  );
}

export function LearnHome({ courseId }: { courseId: string }) {
  const { t, pct, num } = useI18n();
  const [tab, setTab] = useState('content');
  const course = useQuery({
    queryKey: ['learn', courseId, 'course'],
    queryFn: () => coursesApi.get(courseId),
  });
  const curriculum = useQuery({
    queryKey: ['learn', courseId, 'curriculum'],
    queryFn: () => coursesApi.curriculum(courseId),
  });
  const progress = useQuery({
    queryKey: ['learn', courseId, 'progress'],
    queryFn: () => progressApi.course(courseId),
  });

  return (
    <QueryBoundary query={course} skeleton={<Skeleton className="h-64" />}>
      {(c) => (
        <div>
          <Breadcrumbs
            label={t('common.breadcrumb')}
            items={[{ label: t('nav.myDashboard'), href: '/student' }, { label: c.title }]}
          />
          <h1 className="text-2xl font-bold md:text-3xl">{c.title}</h1>
          <Card className="mt-5 p-5">
            <QueryBoundary query={progress} skeleton={<Skeleton className="h-16" />}>
              {(p) => (
                <div className="flex flex-wrap items-center gap-5">
                  <div className="min-w-60 flex-1">
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{t('progress.label')}</span>
                      <span>
                        {pct(p.percent)} ·{' '}
                        {t('progress.lessonsOf', {
                          done: num(p.completedLessons),
                          total: num(p.totalLessons),
                        })}
                      </span>
                    </div>
                    <ProgressBar value={p.percent} label={t('progress.label')} />
                  </div>
                  {curriculum.data &&
                    p.enrollmentStatus !== 'COMPLETED' &&
                    firstIncompleteLesson(curriculum.data) && (
                      <LinkButton
                        href={`/learn/${courseId}/lessons/${firstIncompleteLesson(curriculum.data)?.id}`}
                        variant="accent"
                      >
                        {p.completedLessons > 0 ? t('course.continue') : t('learn.start')}
                      </LinkButton>
                    )}
                  {p.enrollmentStatus === 'COMPLETED' && (
                    <Alert tone="success" className="w-full">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <Award className="size-5" aria-hidden />
                        {t('learn.completedBanner')}
                      </span>
                    </Alert>
                  )}
                </div>
              )}
            </QueryBoundary>
          </Card>
          <div className="mt-6">
            <Tabs
              label={t('learn.sections')}
              value={tab}
              onChange={setTab}
              items={[
                {
                  id: 'content',
                  label: t('learn.tabContent'),
                  content: (
                    <QueryBoundary query={curriculum}>
                      {(cur) =>
                        cur.modules.length === 0 ? (
                          <Alert>{t('curriculum.empty')}</Alert>
                        ) : (
                          <CurriculumList
                            curriculum={{
                              ...cur,
                              modules: cur.modules.map((m) => ({
                                ...m,
                                lessons: m.lessons.map((l) => ({
                                  ...l,
                                  completed:
                                    progress.data?.completedLessonIds.includes(l.id) ?? l.completed,
                                })),
                              })),
                            }}
                            showProgress
                            lessonHref={(l) => `/learn/${courseId}/lessons/${l.id}`}
                          />
                        )
                      }
                    </QueryBoundary>
                  ),
                },
                {
                  id: 'assessments',
                  label: t('learn.tabAssessments'),
                  content: <AssessmentsTab courseId={courseId} />,
                },
                {
                  id: 'assignments',
                  label: t('learn.tabAssignments'),
                  content: <AssignmentsTab courseId={courseId} />,
                },
              ]}
            />
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}
