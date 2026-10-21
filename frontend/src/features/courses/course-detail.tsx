'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Settings, Users } from 'lucide-react';
import { coursesApi, enrollmentsApi } from '@/lib/api/endpoints';
import { errorKey } from '@/lib/api/error-messages';
import { useAuth } from '@/lib/auth';
import { hasRole } from '@/lib/roles';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, LinkButton } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Alert, Badge, Card, Skeleton } from '@/components/ui/primitives';
import { useToast } from '@/components/ui/toast';
import { QueryBoundary } from '@/components/states';
import { CurriculumList } from './curriculum-list';
import { levelKey } from './course-card';
import type { CourseDetail } from '@/lib/api/types';

function EnrollPanel({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const { user, status } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [confirmDrop, setConfirmDrop] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ['course'] });

  const enroll = useMutation({
    mutationFn: () => enrollmentsApi.enroll(course.id),
    onSuccess: () => {
      toast.success(t('course.enrolledToast'));
      void refresh();
      void qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e) => toast.error(t(errorKey(e))),
  });
  const drop = useMutation({
    mutationFn: () => enrollmentsApi.drop(course.id),
    onSuccess: () => {
      setConfirmDrop(false);
      toast.success(t('course.droppedToast'));
      void refresh();
      void qc.invalidateQueries({ queryKey: ['enrollments'] });
    },
    onError: (e) => {
      setConfirmDrop(false);
      toast.error(t(errorKey(e)));
    },
  });

  const enrollment =
    course.enrollment && course.enrollment.status !== 'DROPPED' ? course.enrollment : null;
  let body;
  if (course.canManage) {
    body = (
      <LinkButton href={`/instructor/courses/${course.id}`} size="lg" className="w-full">
        <Settings className="size-5" aria-hidden />
        {t('course.manage')}
      </LinkButton>
    );
  } else if (status === 'loading') {
    body = <Skeleton className="h-12 w-full" />;
  } else if (!user) {
    body = (
      <>
        <LinkButton
          href={`/login?next=${encodeURIComponent(`/courses/${course.slug}`)}`}
          size="lg"
          variant="accent"
          className="w-full"
        >
          {t('course.signInToEnroll')}
        </LinkButton>
        <p className="text-sm text-muted">
          {t('course.noAccount')}{' '}
          <Link className="underline" href="/register">
            {t('auth.register')}
          </Link>
        </p>
      </>
    );
  } else if (!hasRole(user, 'STUDENT')) {
    body = <Alert tone="info">{t('course.studentsOnly')}</Alert>;
  } else if (enrollment) {
    body = (
      <>
        <LinkButton href={`/learn/${course.id}`} size="lg" className="w-full">
          {enrollment.status === 'COMPLETED' ? t('course.review') : t('course.continue')}
        </LinkButton>
        {enrollment.status === 'ACTIVE' && (
          <Button variant="ghost" onClick={() => setConfirmDrop(true)} className="w-full">
            {t('course.drop')}
          </Button>
        )}
      </>
    );
  } else if (course.status !== 'PUBLISHED') {
    body = <Alert tone="warning">{t('course.notOpen')}</Alert>;
  } else {
    body = (
      <Button
        size="lg"
        variant="accent"
        className="w-full"
        loading={enroll.isPending}
        onClick={() => enroll.mutate()}
      >
        {t('course.enroll')}
      </Button>
    );
  }
  return (
    <Card className="flex flex-col gap-3 p-5">
      {body}
      <Dialog
        open={confirmDrop}
        onClose={() => setConfirmDrop(false)}
        dismissible={!drop.isPending}
        title={t('course.dropTitle')}
        description={t('course.dropText')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setConfirmDrop(false)}
              disabled={drop.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button variant="danger" loading={drop.isPending} onClick={() => drop.mutate()}>
              {t('course.dropConfirm')}
            </Button>
          </>
        }
      />
    </Card>
  );
}

export function CourseDetailView({ slug }: { slug: string }) {
  const { t, num, date } = useI18n();
  const { user } = useAuth();
  const course = useQuery({
    queryKey: ['course', 'slug', slug, user?.id ?? null],
    queryFn: () => coursesApi.bySlug(slug),
  });
  const courseId = course.data?.id;
  const curriculum = useQuery({
    queryKey: ['course', 'curriculum', courseId, user?.id ?? null],
    queryFn: () => coursesApi.curriculum(courseId as string),
    enabled: !!courseId,
  });

  return (
    <QueryBoundary
      query={course}
      skeleton={
        <div className="grid gap-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      }
    >
      {(c) => (
        <div>
          <Breadcrumbs
            label={t('common.breadcrumb')}
            items={[
              { label: t('nav.home'), href: '/' },
              { label: t('nav.courses'), href: '/courses' },
              { label: c.title },
            ]}
          />
          <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="info">{t(levelKey(c.level))}</Badge>
                <Badge>{c.language === 'ar' ? 'العربية' : 'English'}</Badge>
                {c.status !== 'PUBLISHED' && (
                  <Badge tone="warning">{t(`status.${c.status}`)}</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold md:text-4xl">{c.title}</h1>
              <p className="mt-3 text-lg text-muted">{c.summary}</p>
              <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
                <span>{t('course.by', { name: c.instructor?.fullName ?? '—' })}</span>
                <span className="inline-flex items-center gap-1">
                  <BookOpen className="size-4" aria-hidden />
                  {t('course.lessonsCount', { n: num(c.lessonCount) })}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="size-4" aria-hidden />
                  {t('course.learners', { n: num(c.learnerCount) })}
                </span>
                {c.publishedAt && (
                  <span>{t('course.published', { date: date(c.publishedAt) })}</span>
                )}
              </p>
              <section className="mt-8" aria-labelledby="about">
                <h2 id="about" className="mb-2 text-xl font-semibold">
                  {t('course.about')}
                </h2>
                <p className="prose-lms">{c.description}</p>
              </section>
              <section className="mt-10" aria-labelledby="curr">
                <h2 id="curr" className="mb-3 text-xl font-semibold">
                  {t('course.curriculum')}
                </h2>
                <QueryBoundary query={curriculum}>
                  {(cur) =>
                    cur.modules.length === 0 ? (
                      <Alert>{t('curriculum.empty')}</Alert>
                    ) : (
                      <CurriculumList
                        curriculum={cur}
                        showProgress={!!c.enrollment && c.enrollment.status !== 'DROPPED'}
                      />
                    )
                  }
                </QueryBoundary>
              </section>
            </div>
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <EnrollPanel course={c} />
            </aside>
          </div>
        </div>
      )}
    </QueryBoundary>
  );
}
