'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { coursesApi, progressApi, structureApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { safeHttpUrl } from '@/lib/url';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, LinkButton } from '@/components/ui/button';
import { Alert, Card, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';
import { CurriculumList } from '@/features/courses/curriculum-list';

export function LessonView({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const lesson = useQuery({
    queryKey: ['learn', courseId, 'lesson', lessonId],
    queryFn: () => structureApi.getLesson(lessonId),
  });
  const curriculum = useQuery({
    queryKey: ['learn', courseId, 'curriculum'],
    queryFn: () => coursesApi.curriculum(courseId),
  });
  const progress = useQuery({
    queryKey: ['learn', courseId, 'progress'],
    queryFn: () => progressApi.course(courseId),
  });

  const completed = progress.data?.completedLessonIds.includes(lessonId) ?? false;
  const toggle = useMutation({
    mutationFn: () =>
      completed ? progressApi.uncomplete(lessonId) : progressApi.complete(lessonId),
    onSuccess: (r) => {
      toast.success(r.completed ? t('lesson.markedDone') : t('lesson.markedUndone'));
      void qc.invalidateQueries({ queryKey: ['learn', courseId] });
      void qc.invalidateQueries({ queryKey: ['progress'] });
      void qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });

  const flat = useMemo(
    () => curriculum.data?.modules.flatMap((m) => m.lessons) ?? [],
    [curriculum.data],
  );
  const idx = flat.findIndex((l) => l.id === lessonId);
  const prev = idx > 0 ? flat[idx - 1] : undefined;
  const next = idx >= 0 ? flat[idx + 1] : undefined;
  const merged = useMemo(
    () =>
      curriculum.data && {
        ...curriculum.data,
        modules: curriculum.data.modules.map((m) => ({
          ...m,
          lessons: m.lessons.map((l) => ({
            ...l,
            completed: progress.data?.completedLessonIds.includes(l.id) ?? l.completed,
          })),
        })),
      },
    [curriculum.data, progress.data],
  );

  return (
    <QueryBoundary query={lesson} skeleton={<Skeleton className="h-96" />}>
      {(l) => {
        const url = safeHttpUrl(l.contentUrl);
        return (
          <div>
            <Breadcrumbs
              label={t('common.breadcrumb')}
              items={[
                { label: t('nav.myDashboard'), href: '/student' },
                { label: t('learn.courseHome'), href: `/learn/${courseId}` },
                { label: l.title },
              ]}
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
              <article className="min-w-0">
                <h1 className="text-2xl font-bold md:text-3xl">{l.title}</h1>
                <Card className="mt-5 p-5 md:p-7">
                  {l.contentType === 'TEXT' ? (
                    <p className="prose-lms">{l.content}</p>
                  ) : url ? (
                    <div className="flex flex-col items-start gap-3">
                      {l.content && <p className="prose-lms">{l.content}</p>}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-(--radius-control) bg-ink-900 px-4 font-medium text-white hover:bg-ink-800"
                      >
                        <ExternalLink className="size-4" aria-hidden />
                        {l.contentType === 'VIDEO' ? t('lesson.openVideo') : t('lesson.openLink')}
                      </a>
                      <p className="text-sm text-muted">{t('lesson.externalNote')}</p>
                    </div>
                  ) : (
                    <Alert tone="warning">{t('lesson.badUrl')}</Alert>
                  )}
                </Card>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    variant={completed ? 'secondary' : 'accent'}
                    size="lg"
                    loading={toggle.isPending}
                    onClick={() => toggle.mutate()}
                    aria-pressed={completed}
                  >
                    <CheckCircle2 className="size-5" aria-hidden />
                    {completed ? t('lesson.undo') : t('lesson.markDone')}
                  </Button>
                  <div className="flex gap-2">
                    {prev ? (
                      <LinkButton
                        href={`/learn/${courseId}/lessons/${prev.id}`}
                        variant="secondary"
                      >
                        <ChevronRight className="flip-rtl size-4" aria-hidden />
                        {t('common.previous')}
                      </LinkButton>
                    ) : null}
                    {next ? (
                      <LinkButton href={`/learn/${courseId}/lessons/${next.id}`}>
                        {t('common.next')}
                        <ChevronLeft className="flip-rtl size-4" aria-hidden />
                      </LinkButton>
                    ) : (
                      <LinkButton href={`/learn/${courseId}`} variant="secondary">
                        {t('learn.courseHome')}
                      </LinkButton>
                    )}
                  </div>
                </div>
                <p className="sr-only" aria-live="polite">
                  {completed ? t('lesson.completed') : ''}
                </p>
              </article>
              <aside className="min-w-0">
                <h2 className="mb-2 text-lg font-semibold">
                  <Link href={`/learn/${courseId}`} className="hover:underline">
                    {t('course.curriculum')}
                  </Link>
                </h2>
                {merged ? (
                  <CurriculumList
                    curriculum={merged}
                    showProgress
                    lessonHref={(x) => `/learn/${courseId}/lessons/${x.id}`}
                    currentLessonId={lessonId}
                  />
                ) : (
                  <Skeleton className="h-48" />
                )}
              </aside>
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}
