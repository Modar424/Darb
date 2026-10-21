'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { coursesApi } from '@/lib/api/endpoints';
import { useI18n } from '@/i18n/provider';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { LinkButton } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Alert, Badge, PageHeader, Skeleton } from '@/components/ui/primitives';
import { QueryBoundary } from '@/components/states';
import { AssessmentsTab } from './assessments-tab';
import { AssignmentsTab } from './assignments-tab';
import { CurriculumTab } from './curriculum-tab';
import { DetailsTab } from './details-tab';
import { LearnersTab } from './learners-tab';

const tone = { DRAFT: 'warning', PUBLISHED: 'success', ARCHIVED: 'neutral' } as const;

export function CourseManage({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const [tab, setTab] = useState('details');
  const q = useQuery({
    queryKey: ['instructor', 'course', courseId],
    queryFn: () => coursesApi.get(courseId),
  });
  return (
    <QueryBoundary query={q} skeleton={<Skeleton className="h-96" />}>
      {(c) =>
        !c.canManage ? (
          <Alert tone="danger" live>
            {t('err.forbidden')}
          </Alert>
        ) : (
          <>
            <Breadcrumbs
              label={t('common.breadcrumb')}
              items={[{ label: t('nav.myCourses'), href: '/instructor' }, { label: c.title }]}
            />
            <PageHeader
              title={c.title}
              actions={
                <>
                  <Badge tone={tone[c.status]}>{t(`status.${c.status}`)}</Badge>
                  {c.status === 'PUBLISHED' && (
                    <LinkButton href={`/courses/${c.slug}`} variant="secondary" size="sm">
                      <ExternalLink className="size-4" aria-hidden />
                      {t('course.viewPublic')}
                    </LinkButton>
                  )}
                </>
              }
            />
            <Tabs
              label={t('course.manageSections')}
              value={tab}
              onChange={setTab}
              items={[
                {
                  id: 'details',
                  label: t('course.tabDetails'),
                  content: <DetailsTab course={c} />,
                },
                {
                  id: 'curriculum',
                  label: t('course.tabCurriculum'),
                  content: <CurriculumTab courseId={c.id} />,
                },
                {
                  id: 'assessments',
                  label: t('learn.tabAssessments'),
                  content: <AssessmentsTab courseId={c.id} />,
                },
                {
                  id: 'assignments',
                  label: t('learn.tabAssignments'),
                  content: <AssignmentsTab courseId={c.id} />,
                },
                {
                  id: 'learners',
                  label: t('course.tabLearners'),
                  content: <LearnersTab courseId={c.id} />,
                },
              ]}
            />
          </>
        )
      }
    </QueryBoundary>
  );
}
