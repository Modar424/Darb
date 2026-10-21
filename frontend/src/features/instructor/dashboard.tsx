'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, PlusCircle } from 'lucide-react';
import { coursesApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { LinkButton } from '@/components/ui/button';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';

const statusTone = { DRAFT: 'warning', PUBLISHED: 'success', ARCHIVED: 'neutral' } as const;

export function InstructorDashboard() {
  const { t, num } = useI18n();
  const q = useQuery({
    queryKey: ['instructor', 'courses'],
    queryFn: () => coursesApi.mine({ pageSize: 50 }),
  });
  return (
    <>
      <PageHeader
        title={t('instructor.title')}
        description={t('instructor.subtitle')}
        actions={
          <LinkButton href="/instructor/courses/new" variant="accent">
            <PlusCircle className="size-5" aria-hidden />
            {t('nav.newCourse')}
          </LinkButton>
        }
      />
      <QueryBoundary query={q}>
        {(page) =>
          page.items.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="size-10" />}
              title={t('instructor.emptyTitle')}
              description={t('instructor.emptyText')}
              action={
                <LinkButton href="/instructor/courses/new" variant="accent">
                  {t('nav.newCourse')}
                </LinkButton>
              }
            />
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {page.items.map((c) => (
                <li key={c.id}>
                  <Card className="flex h-full flex-col gap-2 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`/instructor/courses/${c.id}`}
                        className="text-lg font-semibold underline-offset-4 hover:underline"
                      >
                        {c.title}
                      </Link>
                      <Badge tone={statusTone[c.status]}>{t(`status.${c.status}`)}</Badge>
                    </div>
                    <p className="line-clamp-2 text-muted">{c.summary}</p>
                    <p className="mt-auto pt-2 text-sm text-muted">
                      {t('course.lessonsCount', { n: num(c.lessonCount) })} ·{' '}
                      {t('course.learners', { n: num(c.learnerCount) })}
                    </p>
                  </Card>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </>
  );
}
